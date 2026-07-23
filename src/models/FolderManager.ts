/**
 * @file FolderManager.ts
 * @description Handles data persistence and tree-structure CRUD operations 
 * for folders and chat items using chrome.storage.local.
 */
import type { FolderData, ChatItem } from './Folder';
import { LeftSidebarAdapter } from '../adapters/LeftSidebar';

const MAX_FOLDER_NAME_LENGTH = 40;
const MAX_CHAT_NAME_LENGTH = 80;

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

	/**
     * Generates a unique, platform-specific storage key based on the initialized adapter.
     * @private
     * @returns {string} The composite key used for chrome.storage.
     * @throws {Error} If called before the manager is properly initialized.
     */	
	private static getStorageKey(): string {
        if (!this.adapter) {
            throw new Error('FolderManager not initialized. Call FolderManager.init(adapter) first.');
        }

		const userId = this.adapter.getCachedAccountKey();
		if (!userId) {
			throw new Error('Cannot resolve storage key: User is not logged in.');
		}

		// Sanitize userId to ensure safe key format
		const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
		return `${this.STORAGE_KEY_PREFIX}_${this.adapter.platformId}_${sanitizedUserId}`;
    }

	/**
     * Retrieves the entire hierarchical folder tree from local storage.
     * @returns {Promise<FolderData[]>} A promise resolving to the array of folders.
     */
    static async getFolders(): Promise<FolderData[]> {
        const key = this.getStorageKey();
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve((result[key] as FolderData[]) || []);
            });
        });
    }

    /**
     * Persists the entire folder tree structure back to local storage.
     * @param {FolderData[]} folders - The full folder array to save.
     * @returns {Promise<void>} A promise that resolves when the save operation completes.
     */
	static async saveFolders(folders: FolderData[]): Promise<void> {
		const key = this.getStorageKey();
		return new Promise((resolve, reject) => {
			chrome.storage.local.set({ [key]: folders }, () => {
				if (chrome.runtime.lastError) {
					reject(chrome.runtime.lastError);
				} else {
					resolve();
				}
			});
		});
	}

	/**
     * Creates and inserts a new folder into the tree.
     * @param {string} name - Display name of the folder.
     * @param {string} color - Hex code or style class representing the folder color.
     * @param {string | null} [parentId=null] - ID of the parent folder, or null if it's a root-level folder.
     * @returns {Promise<FolderData[]>} The newly updated folder tree.
     */
	static async addFolder(name: string, color: string, parentId: string | null = null): Promise<FolderData[]> {
        const allFolders = await this.getFolders();

    	const sanitizedName = name.trim().slice(0, MAX_FOLDER_NAME_LENGTH);

        const newFolder: FolderData = {
            id: Date.now().toString(),
            name: sanitizedName,
			color, parentId,
            children: [],
            items: []
        };

        if (!parentId) {
            allFolders.unshift(newFolder);
        } else {
            this.findAndAddChild(allFolders, parentId, newFolder);
        }

        await this.saveFolders(allFolders);
        return allFolders;
    }

	/**
     * Updates the basic profile details of an existing folder.
     * @param {string} id - The unique identifier of the target folder.
     * @param {Object} data - The updated folder metadata.
     * @param {string} data.name - The new name for the folder.
     * @param {string} data.color - The new color for the folder.
     * @returns {Promise<void>}
     */
	public static async updateFolder(id: string, data: { name: string, color: string }): Promise<void> {
		let folders = await this.getFolders();
		const sanitizedName = data.name.trim().slice(0, MAX_FOLDER_NAME_LENGTH);

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

		const sanitizedTitle = (chat.title || 'Untitled Chat')
								.replace(/\s+/g, ' ')
								.trim()
								.slice(0, MAX_CHAT_NAME_LENGTH);

        const chatNode: FolderData = {
            id: `${chat.id}`,
            name: sanitizedTitle,
            color: '#888888',
            parentId: parentId,
            children: [],
            items: [],
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
}