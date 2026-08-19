/**
 * @file Folder.ts
 * @description Type definitions and interfaces for the AI Chat Folders structure.
 */

/**
 * Core interface representing a node within the unified hierarchical tree.
 * A node can functionally act as a container (folder) or a leaf node (chat shortcut).
 */
export interface FolderData {
    /** Unique identifier. For folders: a short auto-incremented number (as string).
     * For chat leaves: the platform's native chat id, unrelated to the counter. */
    id: string;
    /** Display name of the folder or the title of the chat session */
    name: string;
    isCollapsed?: boolean;
    /** Numeric color code — resolve to an actual hex value via resolveColor().
     * Unused (kept as a placeholder) for chat leaves, which never render a color. */
    color: number;
    /** Derived at load time from tree position — never persisted directly.
     * See FolderManager.hydrate()/dehydrate(). */	
    parentId: string | null;
    children: FolderData[];
    isChat?: boolean;
}

/**
 * Discriminates which kind of native-UI change is being reported for a
 * chat. Add new members here (e.g. 'pin', 'archive') as more native
 * signals get intercepted — no event/method renaming required.
 */
export type NativeChangeType = 'delete' | 'rename';
/**
 * Preferences tied to the currently logged-in account on this platform.
 * Requires a resolvable userId, so anything here is only readable/
 * writable once an account is known (e.g. from the right sidebar).
 */
export interface AccountSettings {
	/** Whether chats already saved to a folder should be hidden from the native sidebar. */
	hideChat: boolean;
	/** Whether the one-time dock-trigger onboarding hint has already been shown to this account. */
	hasSeenDockHint: boolean;
}
export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  	hideChat: false,
	hasSeenDockHint: false,
};

/**
 * Preferences tied to the platform/domain as a whole, independent of
 * which account (if any) is currently logged in. Managed from the
 * extension's upcoming settings page, which may be opened before login
 * or without ever resolving a userId — so nothing here may depend on
 * LeftSidebarAdapter.getResolvedAccountKey().
 */
export interface DomainSettings {
	/** Whether the plugin is enabled on this specific domain. */
  	enabled: boolean;	
	/**
	 * Whether native platform changes detected via network interception /
	 * DOM signals (currently: delete; planned: rename) should also be
	 * applied to the corresponding entries in local folders.
	 */
	syncNativeChanges: boolean;
}
export const DEFAULT_DOMAIN_SETTINGS: DomainSettings = {
	enabled: true,
  	syncNativeChanges: true,
};

/**
 * Compact numeric platform codes, used to keep the shared { td, snc } setting
 * item small. Part of the storage schema — NEVER renumber or reuse an
 * existing code; only append new platforms at the end.
 */
export const PLATFORM_CODES: Record<string, number> = {
	gemini: 1,
	chatgpt: 2,
	claude: 3,
	deepseek: 4,
};

/**
 * Unified global setting covering every platform in one small item:
 * - td  (targetDomain): platform codes where the extension is enabled
 * - snc (syncNativeChanges): platform codes with native-change sync enabled
 * Stored as a single chrome.storage.sync item so it stays small enough to
 * roam across the user's devices.
 */
export interface GlobalSetting {
	td: number[];
	snc: number[];
	/**
	 * Whether cloud sync (chrome.storage.sync) is enabled, globally across
	 * every platform — a single on/off switch, not per-platform. 0/1 rather
	 * than boolean to match the compact numeric style of this item, since
	 * it's the one setting item small/stable enough to roam ahead of
	 * everything else. Default 0: local-only until the user opts in from
	 * the options page.
	 */
	cs: 0 | 1;
}
export const DEFAULT_GLOBAL_SETTING: GlobalSetting = {
	td: Object.values(PLATFORM_CODES),
	snc: Object.values(PLATFORM_CODES),
	cs: 0,
};

/**
 * Preset folder colors. Only the numeric code is persisted in storage; the
 * actual hex value is resolved from this table at render time. Same
 * append-only rule as PLATFORM_CODES — never renumber or reuse a code.
 */
export const COLOR_TABLE: Record<number, string> = {
	1: '#3498db',
	2: '#2ecc71',
	3: '#f1c40f',
	4: '#e74c3c',
	5: '#9b59b6',
	6: '#f39c12',
	7: '#8e44ad',
	8: '#fd79a8',
};
export const DEFAULT_COLOR_CODE = 1;

/** Resolves a stored color code to its display hex value, falling back to the default. */
export function resolveColor(code: number): string {
  	return COLOR_TABLE[code] ?? COLOR_TABLE[DEFAULT_COLOR_CODE]!;
}

/** Full shape persisted under a single per-account chrome.storage.local key. */
export interface StorageSchema {
	folders: FolderData[];
	settings: AccountSettings;
	/** Auto-increment counter used to assign short numeric folder ids. */
	nextId: number;
}