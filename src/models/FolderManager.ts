/**
 * @file FolderManager.ts
 * @description Handles data persistence and tree-structure CRUD operations 
 * for folders and chat items using chrome.storage.local.
 */
import type { FolderData, StorageSchema, DomainSettings, AccountSettings, GlobalSetting } from './Folder';
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_DOMAIN_SETTINGS, DEFAULT_GLOBAL_SETTING, DEFAULT_COLOR_CODE, PLATFORM_CODES } from './Folder';
import { LeftSidebarAdapter } from '../adapters/LeftSidebar';

const MAX_FOLDER_NAME_BYTES = 60;
const MAX_CHAT_NAME_BYTES = 90;

/** Chat-leaf nodes never render a color; this is just a neutral placeholder. */
const CHAT_LEAF_COLOR_CODE = 0;

/**
 * Truncates a string to at most `maxBytes` when encoded as UTF-8, without
 * splitting a multi-byte character in half. Plain `.slice(0, n)` truncates
 * by UTF-16 code unit, which silently allows far more storage bytes for
 * CJK/emoji text (up to 4 bytes/char) than for ASCII.
 */
function truncateUtf8Bytes(str: string, maxBytes: number): string {
    const encoded = new TextEncoder().encode(str);
    if (encoded.length <= maxBytes) return str;

    let end = maxBytes;
    // UTF-8 continuation bytes look like 10xxxxxx (0x80-0xBF) — back off
    // until we land on the start of a character, not mid-character.
    while (end > 0 && (encoded[end]! & 0xc0) === 0x80) {
        end--;
    }
    return new TextDecoder('utf-8').decode(encoded.slice(0, end));
}

/** Adds or removes a numeric code from a sorted, de-duplicated code list. */
function withCode(codes: number[], code: number, include: boolean): number[] {
    const set = new Set(codes);
    if (include) set.add(code);
    else set.delete(code);
    return Array.from(set).sort((a, b) => a - b);
}

/**
 * Compact on-disk shape actually written to chrome.storage.local.
 * - Keys are abbreviated (id/nm/cl/ch/cd/isC) since this shape repeats
 *   once per node and dominates the item's serialized size.
 * - parentId is NOT stored — it's fully redundant given the children-based
 *   tree, and is reconstructed on load instead (see hydrate()).
 * - Any field left at its default (false / empty array / not-a-chat-leaf's
 *   irrelevant color) is omitted rather than written explicitly.
 */
interface StoredNode {
    id: string;
    nm: string;
    /** Color code. Omitted for chat leaves, which never render a color. */
    cl?: number;
    /** Children. Omitted when empty (covers both chat leaves, which never
     * have any, and folders that happen to be empty). */
    ch?: StoredNode[];
    /** isCollapsed. Only written when true (the non-default state). */
    cd?: 1;
    /** isChat. Only written when true (the non-default state — absence means folder). */
    isC?: 1;
}

// ── Cloud sync (chrome.storage.sync) shapes ──────────────────────────────
// See docs/features/CloudSync.md for the full design. Summary: the folder
// STRUCTURE is shared globally across every platform/account (one tree,
// key `acf_folders`), while which chats are filed where is tracked
// separately, per platform+account, as small chunked items
// (`acf_c_{platformCode}_{userId}_{idx}`) — this keeps a single account's
// chat list from bloating the one item every other account also reads.

/**
 * chrome.storage.sync hard-caps a single item at 8192 bytes
 * (QUOTA_BYTES_PER_ITEM). Chunks are packed under this, leaving headroom
 * for the wrapping object/key and JSON punctuation overhead.
 */
const MAX_SYNC_CHUNK_BYTES = 7000;

/**
 * One chat-to-folder reference, synced per platform+account. Abbreviated
 * keys for the same reason as StoredNode — this shape repeats once per
 * saved chat and dominates a chunk's serialized size.
 */
interface SyncChatRef {
    id: string;   // native chat id, as issued by the AI platform
    nm: string;   // chat title
    fid: string;  // id of the folder (in the shared tree) it's filed under
}

/**
 * Manager class responsible for handling storage, retrieval, modification,
 * and advanced structural reordering (drag-and-drop) of the folder tree.
 */
export class FolderManager {

    private static STORAGE_KEY_PREFIX = 'acf';
    private static adapter: LeftSidebarAdapter | null = null;

	/**
     * Initializes the FolderManager with the current platform's sidebar adapter.
     * Must be called at the application's entry point before invoking any other method.
     * @param {LeftSidebarAdapter} adapter - The active platform adapter (e.g., Gemini, ChatGPT).
     */
    static init(adapter: LeftSidebarAdapter): void {
        this.adapter = adapter;
    }

    // ── Storage area abstraction ──────────────────────────────────────────
    // chrome.storage.local and chrome.storage.sync expose the exact same
    // callback-based API shape, so this one pair of helpers covers both —
    // no separate code paths needed per storage backend.

    private static storageArea(area: 'local' | 'sync'): chrome.storage.StorageArea {
        return area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    }

    private static storageGet<T = any>(area: 'local' | 'sync', keys: string[]): Promise<Record<string, T>> {
        return new Promise((resolve) => {
            this.storageArea(area).get(keys, (result) => resolve(result as Record<string, T>));
        });
    }

    private static storageSet(area: 'local' | 'sync', data: Record<string, any>): Promise<void> {
        return new Promise((resolve, reject) => {
            this.storageArea(area).set(data, () => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve();
            });
        });
    }

    /**
     * Reads every key currently in an area. Used for the sync-side chat-ref
     * chunks (`acf_c_{platformCode}_{userId}_{idx}`) so their count never
     * needs a separate meta/counter item — chrome.storage.sync's total quota
     * (100KB) is small enough to fetch in one call and filter by prefix.
     */
    private static storageGetAll(area: 'local' | 'sync'): Promise<Record<string, any>> {
        return new Promise((resolve) => {
            this.storageArea(area).get(null, (result) => resolve(result));
        });
    }

    private static storageRemove(area: 'local' | 'sync', keys: string[]): Promise<void> {
        if (keys.length === 0) return Promise.resolve();
        return new Promise((resolve, reject) => {
            this.storageArea(area).remove(keys, () => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve();
            });
        });
    }

	/**
	 * Per-account key: folders + AccountSettings. Requires a resolvable
	 * userId, since two accounts on the same platform must not share
	 * folders or sidebar toggles.
	 * @private
	 */
	private static getAccountStorageKey(): string {
		if (!this.adapter) {
			throw new Error('FolderManager not initialized. Call FolderManager.init(adapter) first.');
		}
		const userId = this.adapter.getResolvedAccountKey();
		if (!userId) {
			throw new Error('Cannot resolve storage key: User is not logged in.');
		}
		const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
		return `${this.STORAGE_KEY_PREFIX}_${this.adapter.platformId}_${sanitizedUserId}`;
	}

    /** Single shared key for the unified { td, snc } global setting (chrome.storage.sync). */
    private static readonly GLOBAL_SETTING_KEY = `${this.STORAGE_KEY_PREFIX}_setting`;

    static getGlobalSettingStorageKey(): string {
        return this.GLOBAL_SETTING_KEY;
    }

    /** Single shared key for the folder-only tree, synced across every platform/account. */
    private static readonly SYNC_FOLDERS_KEY = `${this.STORAGE_KEY_PREFIX}_folders`;
	
    static getPlatformCode(platformId: string): number | undefined {
        return PLATFORM_CODES[platformId];
    }
	
	/**
	 * Reads this account's { folders, settings, nextId } bundle from
	 * chrome.storage.local, under the per-account key returned by
	 * getAccountStorageKey() (acf_{platform}_{userId}). Always the LOCAL
	 * copy, regardless of the cloud-sync toggle — used directly by
	 * getAccountSettings()/updateAccountSettings() (settings are never
	 * synced) and as one branch of the mode-routed getStorageData() below.
	 * Missing fields are backfilled with defaults, so callers never need to
	 * null-check the result.
	 */
	private static async getLocalStorageData(): Promise<StorageSchema> {
		const key = this.getAccountStorageKey();
		const result = await this.storageGet<{ f?: StoredNode[]; settings?: AccountSettings; nextId?: number }>('local', [key]);
		const data = result[key] || {};
		return {
			folders: this.hydrate(data.f, null),
			settings: { ...DEFAULT_ACCOUNT_SETTINGS, ...(data.settings || {}) },
			nextId: data.nextId ?? 1,
		};
	}

	private static async saveLocalStorageData(data: StorageSchema): Promise<void> {
		const key = this.getAccountStorageKey();
		await this.storageSet('local', {
			[key]: {
				f: this.dehydrate(data.folders),
				settings: data.settings,
				nextId: data.nextId,
			}
		});
	}

	/**
	 * Cloud-mode reader: folder STRUCTURE comes from the shared
	 * `acf_folders` item, this account's chat filing comes from its own
	 * `acf_c_*` chunks, grafted together into the same mixed shape
	 * getLocalStorageData() returns. `settings` is intentionally still read
	 * from local — it's a per-device preference, not data, so it's never
	 * routed through cloud sync either way (see docs/features/CloudSync.md).
	 */
	private static async getCloudStorageData(): Promise<StorageSchema> {
		const [{ settings }, { folders, nextId }, refs] = await Promise.all([
			this.getLocalStorageData(),
			this.readSyncFolders(),
			this.getCurrentAccountChatRefs(),
		]);
		return { folders: this.graftChatRefs(folders, refs), settings, nextId };
	}

	private static async saveCloudStorageData(data: StorageSchema): Promise<void> {
		// Settings always persist locally, independent of storage mode.
		const local = await this.getLocalStorageData();
		await this.saveLocalStorageData({ ...local, settings: data.settings });

		await this.writeSyncFolders(data.folders, data.nextId);
		if (this.adapter) {
			const userId = this.adapter.getResolvedAccountKey();
			if (userId) {
				await this.writeChatRefsToSync(this.adapter.platformId, userId, this.extractChatRefs(data.folders));
			}
		}
	}

	/**
	 * Mode-routed entry point used by every folder-tree CRUD method below —
	 * local and cloud are two independent stores (see the "Cloud sync"
	 * section further down), never merged into each other. Which one this
	 * resolves to depends solely on the global toggle at the moment of the
	 * call.
	 */
	private static async getStorageData(): Promise<StorageSchema> {
		return (await this.isCloudSyncEnabled()) ? this.getCloudStorageData() : this.getLocalStorageData();
	}

	private static async saveStorageData(data: StorageSchema): Promise<void> {
		return (await this.isCloudSyncEnabled()) ? this.saveCloudStorageData(data) : this.saveLocalStorageData(data);
	}

	// ── Account-scoped: sidebar toggles (e.g. hideChat) — always local ───
	static async getAccountSettings(): Promise<AccountSettings> {
		const data = await this.getLocalStorageData();
		return data.settings;
	}

	static async updateAccountSettings(partial: Partial<AccountSettings>): Promise<AccountSettings> {
		const data = await this.getLocalStorageData();
		data.settings = { ...data.settings, ...partial };
		await this.saveLocalStorageData(data);
		return data.settings;
	}

    // ── Global setting: one shared { td, snc } item across ALL platforms ───
    static async getGlobalSetting(): Promise<GlobalSetting> {
        const result = await this.storageGet<GlobalSetting>('sync', [this.GLOBAL_SETTING_KEY]);
        const raw = result[this.GLOBAL_SETTING_KEY];
        return {
            td: raw?.td ?? DEFAULT_GLOBAL_SETTING.td,
            snc: raw?.snc ?? DEFAULT_GLOBAL_SETTING.snc,
            cs: raw?.cs ?? DEFAULT_GLOBAL_SETTING.cs,
        };
    }

    static async updateGlobalSetting(mutate: (current: GlobalSetting) => GlobalSetting): Promise<GlobalSetting> {
        const current = await this.getGlobalSetting();
        const updated = mutate(current);
        await this.storageSet('sync', { [this.GLOBAL_SETTING_KEY]: updated });
        return updated;
    }

    // ── Cloud sync toggle (single global switch, all platforms) ──────────
    static async isCloudSyncEnabled(): Promise<boolean> {
        const setting = await this.getGlobalSetting();
        return setting.cs === 1;
    }

    /**
     * Flips the global cloud-sync switch. This alone is all the options
     * page (which has no platform adapter / logged-in account context) can
     * do — it just writes the flag to chrome.storage.sync. The flag itself
     * then propagates to every open tab via chrome.storage.onChanged, and
     * each tab's own content-script instance (which DOES have an adapter +
     * resolved account) is responsible for reconciling its own account's
     * data against the cloud the next time it sees the flag turn on — see
     * RightSidebar's cloud-sync watcher and `syncWithCloud()` below.
     */
    static async setCloudSyncEnabled(enabled: boolean): Promise<void> {
        await this.updateGlobalSetting((current) => ({ ...current, cs: enabled ? 1 : 0 }));
    }

    // ── Per-platform view over the global setting. Kept so existing callers
    // (options page, RightSidebar) don't need to know about td/snc codes. ──
    static async getDomainSettings(platformId?: string): Promise<DomainSettings> {
        const id = platformId ?? this.adapter?.platformId;
        if (!id) {
            throw new Error('FolderManager: platformId is required to resolve domain settings.');
        }
        const code = PLATFORM_CODES[id];
        const setting = await this.getGlobalSetting();
        return {
            enabled: code !== undefined ? setting.td.includes(code) : DEFAULT_DOMAIN_SETTINGS.enabled,
            syncNativeChanges: code !== undefined ? setting.snc.includes(code) : DEFAULT_DOMAIN_SETTINGS.syncNativeChanges,
        };
    }

    static async updateDomainSettings(partial: Partial<DomainSettings>, platformId?: string): Promise<DomainSettings> {
        const id = platformId ?? this.adapter?.platformId;
        if (!id) {
            throw new Error('FolderManager: platformId is required to resolve domain settings.');
        }
        const code = PLATFORM_CODES[id];
        if (code === undefined) {
            throw new Error(`FolderManager: unknown platformId "${id}".`);
        }

        const updated = await this.updateGlobalSetting((current) => ({
            ...current,
            td: partial.enabled !== undefined ? withCode(current.td, code, partial.enabled) : current.td,
            snc: partial.syncNativeChanges !== undefined ? withCode(current.snc, code, partial.syncNativeChanges) : current.snc,
        }));

        return {
            enabled: updated.td.includes(code),
            syncNativeChanges: updated.snc.includes(code),
        };
    }

	/**
	 * Converts the compact on-disk tree into the full runtime FolderData tree:
	 * reconstructs parentId from recursion position, and fills in every
	 * omitted field with its default.
	 */
	private static hydrate(nodes: StoredNode[] | undefined, parentId: string | null): FolderData[] {
		if (!nodes) return [];
		return nodes.map((n): FolderData => {
			const isChat = n.isC === 1;
			return {
				id: n.id,
				name: n.nm,
				color: isChat ? CHAT_LEAF_COLOR_CODE : (n.cl ?? DEFAULT_COLOR_CODE),
				parentId,
				isCollapsed: n.cd === 1,
				isChat,
				children: this.hydrate(n.ch, n.id),
			};
		});
	}

	/**
	 * Converts the full runtime FolderData tree back into the compact on-disk
	 * shape: drops parentId, abbreviates keys, and omits any field currently
	 * at its default value.
	 */
	private static dehydrate(nodes: FolderData[]): StoredNode[] {
		return nodes.map((f): StoredNode => {
			const out: StoredNode = { id: f.id, nm: f.name };
			if (!f.isChat) out.cl = f.color; // color is meaningless for chat leaves — never persisted for them
			if (f.isCollapsed) out.cd = 1;
			if (f.isChat) out.isC = 1;
			if (f.children && f.children.length > 0) out.ch = this.dehydrate(f.children);
			return out;
		});
	}	

    // ── Cloud sync: folder-only tree (shared, `acf_folders`) ──────────────
    // Local and cloud are two INDEPENDENT storage modes, not two sources
    // reconciled into one — switching the global toggle just changes which
    // store subsequent reads/writes target. Turning cloud sync on for the
    // first time starts from whatever's already in `acf_folders` (empty, if
    // no device has used it yet — the user builds their folder list fresh
    // there); turning it back off returns to local exactly as it was left,
    // untouched the whole time. See docs/features/CloudSync.md.

    /** Same as dehydrate(), but drops chat leaves — the synced tree is pure
     * structure. Which chats live where is tracked separately, per
     * platform+account (see writeChatRefsToSync below). */
    private static dehydrateFoldersOnly(nodes: FolderData[]): StoredNode[] {
        return nodes
            .filter(f => !f.isChat)
            .map((f): StoredNode => {
                const out: StoredNode = { id: f.id, nm: f.name, cl: f.color };
                if (f.isCollapsed) out.cd = 1;
                const children = this.dehydrateFoldersOnly(f.children || []);
                if (children.length > 0) out.ch = children;
                return out;
            });
    }

    private static async readSyncFolders(): Promise<{ folders: FolderData[]; nextId: number }> {
        const result = await this.storageGet<{ f?: StoredNode[]; nextId?: number }>('sync', [this.SYNC_FOLDERS_KEY]);
        const data = result[this.SYNC_FOLDERS_KEY] || {};
        return { folders: this.hydrate(data.f, null), nextId: data.nextId ?? 1 };
    }

    private static async writeSyncFolders(folders: FolderData[], nextId: number): Promise<void> {
        await this.storageSet('sync', {
            [this.SYNC_FOLDERS_KEY]: { f: this.dehydrateFoldersOnly(folders), nextId },
        });
    }

    // ── Cloud sync: chat-to-folder references (per platform+account, chunked) ──

    private static getChatSyncKeyPrefix(platformId: string, userId: string): string {
        const code = PLATFORM_CODES[platformId];
        if (code === undefined) throw new Error(`FolderManager: unknown platformId "${platformId}".`);
        const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${this.STORAGE_KEY_PREFIX}_c_${code}_${sanitizedUserId}_`;
    }

    /** Extracts every chat-to-folder reference out of a mixed runtime tree. */
    private static extractChatRefs(nodes: FolderData[]): SyncChatRef[] {
        const refs: SyncChatRef[] = [];
        const walk = (list: FolderData[]) => {
            for (const f of list) {
                if (f.isChat && f.parentId) refs.push({ id: f.id, nm: f.name, fid: f.parentId });
                if (f.children?.length) walk(f.children);
            }
        };
        walk(nodes);
        return refs;
    }

    /**
     * Grafts chat leaves back onto a folder-only tree, reconstructing the
     * same mixed shape the rest of the app already works with. A ref whose
     * folder no longer exists is silently dropped — the same tolerance the
     * rest of the codebase already has for stale references.
     */
    private static graftChatRefs(folderTree: FolderData[], refs: SyncChatRef[]): FolderData[] {
        const byId = new Map<string, FolderData>();
        const index = (list: FolderData[]) => {
            for (const f of list) {
                byId.set(f.id, f);
                if (f.children?.length) index(f.children);
            }
        };
        index(folderTree);

        for (const ref of refs) {
            const parent = byId.get(ref.fid);
            if (!parent) continue; // orphaned reference — parent folder no longer exists
            parent.children = parent.children || [];
            if (parent.children.some(c => c.isChat && c.id === ref.id)) continue; // de-dupe
            parent.children.push({
                id: ref.id, name: ref.nm, color: CHAT_LEAF_COLOR_CODE,
                parentId: ref.fid, children: [], isChat: true,
            });
        }
        return folderTree;
    }

    /**
     * Greedily packs chat refs into JSON chunks that each stay under
     * MAX_SYNC_CHUNK_BYTES once serialized, so no single sync item exceeds
     * chrome's per-item quota.
     */
    private static packChatRefs(refs: SyncChatRef[]): SyncChatRef[][] {
        const chunks: SyncChatRef[][] = [];
        let current: SyncChatRef[] = [];
        for (const ref of refs) {
            const candidate = [...current, ref];
            const size = new TextEncoder().encode(JSON.stringify(candidate)).length;
            if (size > MAX_SYNC_CHUNK_BYTES && current.length > 0) {
                chunks.push(current);
                current = [ref];
            } else {
                current = candidate;
            }
        }
        if (current.length > 0) chunks.push(current);
        return chunks;
    }

    /**
     * Re-chunks and overwrites this platform+account's entire chat-ref set
     * on chrome.storage.sync (full repack, not incremental append), then
     * removes any now-unused trailing chunk keys — e.g. after chats were
     * deleted and fewer chunks are needed than last time. Repacking from
     * scratch on every write is simpler than tracking per-chunk deltas and
     * cheap enough at the scale these lists actually reach.
     */
    private static async writeChatRefsToSync(platformId: string, userId: string, refs: SyncChatRef[]): Promise<void> {
        const prefix = this.getChatSyncKeyPrefix(platformId, userId);
        const all = await this.storageGetAll('sync');
        const oldKeys = Object.keys(all).filter(k => k.startsWith(prefix));

        const chunks = this.packChatRefs(refs);
        const toSet: Record<string, SyncChatRef[]> = {};
        chunks.forEach((chunk, idx) => { toSet[`${prefix}${idx}`] = chunk; });

        if (Object.keys(toSet).length > 0) await this.storageSet('sync', toSet);
        const staleKeys = oldKeys.filter(k => !(k in toSet));
        await this.storageRemove('sync', staleKeys);
    }

    private static async readChatRefsFromSync(platformId: string, userId: string): Promise<SyncChatRef[]> {
        const prefix = this.getChatSyncKeyPrefix(platformId, userId);
        const all = await this.storageGetAll('sync');
        const refs: SyncChatRef[] = [];
        Object.keys(all).filter(k => k.startsWith(prefix)).sort()
            .forEach(k => refs.push(...(all[k] as SyncChatRef[])));
        return refs;
    }

    /** This account's chat refs from chrome.storage.sync, or [] if unresolvable. */
    private static async getCurrentAccountChatRefs(): Promise<SyncChatRef[]> {
        if (!this.adapter) return [];
        const userId = this.adapter.getResolvedAccountKey();
        if (!userId) return [];
        return this.readChatRefsFromSync(this.adapter.platformId, userId);
    }

	/**
     * Retrieves the entire hierarchical folder tree from local storage.
     * @returns {Promise<FolderData[]>} A promise resolving to the array of folders.
     */
    static async getFolders(): Promise<FolderData[]> {
		const data = await this.getStorageData();
		return data.folders;
    }

    /**
     * Persists the entire folder tree structure back to local storage.
     * @param {FolderData[]} folders - The full folder array to save.
     * @returns {Promise<void>} A promise that resolves when the save operation completes.
     */
	static async saveFolders(folders: FolderData[]): Promise<void> {
		const data = await this.getStorageData();
		data.folders = folders;
		await this.saveStorageData(data);
	}

    /**
     * Creates and inserts a new folder into the tree.
     * @param {string} name - Display name of the folder.
     * @param {number} color - Preset color code (see COLOR_TABLE in Folder.ts).
     * @param {string | null} [parentId=null] - Parent folder id, or null for root-level.
     */
    static async addFolder(name: string, color: number, parentId: string | null = null): Promise<FolderData[]> {
        const data = await this.getStorageData();
        const sanitizedName = truncateUtf8Bytes(name.trim(), MAX_FOLDER_NAME_BYTES);

        const newFolder: FolderData = {
            id: String(data.nextId),
            name: sanitizedName,
            color, parentId,
            children: [],
        };
        data.nextId += 1;

        if (!parentId) {
            data.folders.unshift(newFolder);
        } else {
            this.findAndAddChild(data.folders, parentId, newFolder);
        }

        await this.saveStorageData(data);
        return data.folders;
    }

	/**
     * Updates the basic profile details of an existing folder.
     * @param {string} id - The unique identifier of the target folder.
     * @param {Object} data - The updated folder metadata.
     * @param {string} data.name - The new name for the folder.
     * @param {string} data.color - The new color for the folder.
     * @returns {Promise<void>}
     */
	public static async updateFolder(id: string, data: { name: string, color: number }): Promise<void> {
        let folders = await this.getFolders();
        const sanitizedName = truncateUtf8Bytes(data.name.trim(), MAX_FOLDER_NAME_BYTES);

        const updateInTree = (list: FolderData[]) => {
            for (const f of list) {
                if (f.id === id) {
                    f.name = sanitizedName;
                    f.color = data.color;
                    return true;
                }
                if (f.children && updateInTree(f.children)) return true;
            }
            return false;
        };

        updateInTree(folders);
        await this.saveFolders(folders);
	}	

	/**
     * Deletes a folder node from the tree by its ID.
     * @param {string} id - The ID of the folder to be removed.
     * @returns {Promise<FolderData[]>} The updated folder tree without the deleted folder.
     */
	static async deleteFolder(id: string): Promise<FolderData[]> {
        const folders = await this.getFolders();
        const removeNode = (list: FolderData[]): FolderData[] => {
            return list
                .filter(f => f.id !== id)
                .map(f => ({
                    ...f,
                    children: removeNode(f.children || [])
                }));
        };
        const updated = removeNode(folders);
        await this.saveFolders(updated);
        return updated;
    }

	/**
     * Performs a highly flexible tree reordering, supporting cross-level node displacement (Drag & Drop).
     * @param {string} draggedId - The ID of the node currently being dragged.
     * @param {string} targetId - The ID of the node where the dragged item is dropped.
     * @param {'before' | 'after' | 'inside'} position - Relative positioning rule for the placement.
     * @returns {Promise<FolderData[]>} The updated folder tree after mutation.
     */
	static async reorder(
		draggedId: string, 
		targetId: string, 
		position: 'before' | 'after' | 'inside',
	): Promise<FolderData[]> {
		const folders = await this.getFolders();
		let draggedNode: FolderData | null = null;

		// Detach: Recursive helper to safely splice the moving node from its original location
		const detach = (list: FolderData[]): void => {
			for (let i = 0; i < list.length; i++) {
				const current = list[i];
				if (!current) continue; // TypeScript Type Guard

				if (current.id === draggedId) {
					const removed = list.splice(i, 1);
					if (removed.length > 0) {
						draggedNode = removed[0]!;
					}
					return;
				}
				if (current.children) detach(current.children);
			}
		};

		detach(folders);
		if (!draggedNode) return folders;

		// Local immutable reference to lock TS compiler type inference
		const movingNode = draggedNode;

		// Attach: Recursive helper to insert the detached node into its new target destination
		const attach = (list: FolderData[], parentId: string | null = null): boolean => {
			const idx = list.findIndex(f => f.id === targetId);
			
			if (idx !== -1) {
				const targetNode = list[idx];
				if (!targetNode) return false; // TS Guard

				const nodeToInsert = movingNode as FolderData;

				if (position === 'inside') {
					targetNode.children = targetNode.children || [];
					nodeToInsert.parentId = targetNode.id;
					targetNode.children.push(movingNode);
				} else {
					nodeToInsert.parentId = parentId;
					const insertAt = position === 'before' ? idx : idx + 1;
					list.splice(insertAt, 0, movingNode);
				}
				return true;
			}

			for (const f of list) {
				if (f.children && attach(f.children, f.id)) return true;
			}
			return false;
		};

		attach(folders, null);
		await this.saveFolders(folders);
		return folders;
	}

	/**
     * Traverses the tree recursively to find the parent folder and append a new child folder.
     * @private
     * @param {FolderData[]} list - Subtree list currently being scanned.
     * @param {string} parentId - Target parent folder identifier.
     * @param {FolderData} newNode - Pre-constructed folder object to be inserted.
     * @returns {boolean} True if insertion succeeded, false otherwise.
     */
    private static findAndAddChild(list: FolderData[], parentId: string, newNode: FolderData): boolean {
        for (const folder of list) {
            if (folder.id === parentId) {
                folder.children = folder.children || [];
                folder.children.push(newNode);
                return true;
            }
            if (folder.children && this.findAndAddChild(folder.children, parentId, newNode)) return true;
        }
        return false;
    }

	/**
     * Saves a specific chat session metadata as a leaf node inside a designated folder.
     * Seamlessly prevents duplicate identical leaf additions within the same folder boundary.
     * @param {string} parentId - The destination folder ID.
     * @param {Object} chat - Extracted telemetry of the chat session.
     * @param {string} chat.id - Original chat history identifier from the AI engine.
     * @param {string} chat.title - Current localized title of the chat.
     * @returns {Promise<FolderData[]>} The modified tree structure.
     */
    static async saveChatToFolder(parentId: string, chat: { id: string; title: string }): Promise<FolderData[]> {
        const folders = await this.getFolders();

        const sanitizedTitle = truncateUtf8Bytes(
            (chat.title || 'Untitled Chat').replace(/\s+/g, ' ').trim(),
            MAX_CHAT_NAME_BYTES
        );

        const chatNode: FolderData = {
            id: `${chat.id}`,
            name: sanitizedTitle,
            color: CHAT_LEAF_COLOR_CODE,
            parentId: parentId,
            children: [],
            isChat: true,
        };

        const insertChatNode = (list: FolderData[]): boolean => {
            for (const folder of list) {
                if (folder.id === parentId) {
                    folder.children = folder.children || [];

                    // Avoid duplicates within the same folder
                    const exists = folder.children.some(child => child.id === chatNode.id);
                    if (!exists) {
                        folder.children.push(chatNode);
                    }
                    return true;
                }
                if (folder.children && insertChatNode(folder.children)) {
                    return true;
                }
            }
            return false;
        };

        insertChatNode(folders);
		this.expandAncestors(folders, parentId); 
        await this.saveFolders(folders);
        return folders;
    }

	/**
	 * Expands (isCollapsed = false) the target folder and every ancestor above it,
	 * since a collapsed ancestor hides its whole subtree via CSS regardless of the
	 * child's own collapse state.
	 * @private
	 */
	private static expandAncestors(folders: FolderData[], folderId: string): void {
		// Flatten the tree into a lookup map so we can walk up the parentId chain.
		const map = new Map<string, FolderData>();
		const buildMap = (list: FolderData[]) => {
			for (const f of list) {
				map.set(f.id, f);
				if (f.children) buildMap(f.children);
			}
		};
		buildMap(folders);
		let current = map.get(folderId);
		while (current) {
			current.isCollapsed = false;
			current = current.parentId ? map.get(current.parentId) : undefined;
		}
	}

	/**
	 * Expands the given folder (and all its ancestors) and persists the change.
	 * Call this before showing UI that gets injected into a folder's children
	 * container, since that container stays display:none while the folder itself
	 * (or any ancestor) is collapsed.
	 * @param {string} folderId - Target folder to expand.
	 * @returns {Promise<FolderData[]>} The updated folder tree.
	 */
	static async expandFolder(folderId: string): Promise<FolderData[]> {
		const folders = await this.getFolders();
		this.expandAncestors(folders, folderId);
		await this.saveFolders(folders);
		return folders;
	}

 	/**
     * Deletes a versatile single node (can be an abstract subfolder or an operational chat leaf) from the tree.
     * @param {string} id - Unique identifier of the node targeted for wipeout.
     * @param {string} [parentId] - If provided, narrows structural search scope down to this explicit parent.
     * Essential for granular item deletion without accidentally pruning matching global items.
     * @returns {Promise<FolderData[]>} A complete refreshed folder representation.
     */
    static async deleteNode(id: string, parentId?: string): Promise<FolderData[]> {
        const folders = await this.getFolders();

		// Functional recursive mapper to reconstruct clean subtrees while wiping matching references
        const removeNode = (list: FolderData[]): FolderData[] => {
            return list
                .filter(f => {
					
                    // Strict compound checking for chat leaves linked to a specific folder
                    if (f.isChat && parentId) {
                        return !(f.id === id && f.parentId === parentId);
                    }
                    // Global sweep fallback for folder clusters or generic matches
                    return f.id !== id;
                })
                .map(f => ({
                    ...f,
                    children: removeNode(f.children || [])
                }));
        };

        const updated = removeNode(folders);
        await this.saveFolders(updated);
        return updated;
    }

	/**
	 * Renames every node matching the given id, in place, without touching
	 * position, color, or children. A single chat can be saved into multiple
	 * folders, so all matches are updated — not just the first one found.
	 * @param {string} id - Unique identifier of the target node.
	 * @param {string} newName - The new display name / chat title.
	 * @returns {Promise<FolderData[]>} The updated folder tree.
	 */
	static async renameNode(id: string, newName: string): Promise<FolderData[]> {
		const folders = await this.getFolders();
        // renameNode targets chat leaves (native rename sync), so use the chat byte budget.
        const sanitizedName = truncateUtf8Bytes(newName.trim(), MAX_CHAT_NAME_BYTES);
		const renameInTree = (list: FolderData[]): void => {
			for (const f of list) {
				if (f.id === id) {
					f.name = sanitizedName;
				}
				if (f.children) renameInTree(f.children);
			}
		};
		renameInTree(folders);
		await this.saveFolders(folders);
		return folders;
	}
}