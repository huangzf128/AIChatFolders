/**
 * @file RightSidebar.ts
 * @description Orchestrates the folder tree UI panel, persistent user interaction state,
 * modal anchoring for editing forms, and event delegation for advanced drag-and-drop tree reordering.
 */
import { FolderManager } from '../models/FolderManager';
import { FolderEditor } from './FolderEditor';
import { ICONS } from './icons';
import { GlobalStyles } from '../ui/styles/index';
import type { FolderData, AccountSettings, DomainSettings, NativeChangeType } from '../models/Folder';
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_DOMAIN_SETTINGS, DEFAULT_GLOBAL_SETTING, resolveColor } from '../models/Folder';
import { LeftSidebarAdapter } from '../adapters/LeftSidebar';

// Class name applied to native sidebar rows that should be hidden
const NATIVE_HIDDEN_CLASS = 'aichat-native-hidden';

/**
 * Main presentation component responsible for rendering and handling interactions
 * on the right slide-out drawer panel inside the targeted AI platform interface.
 */
export class RightSidebar {
    private panel: HTMLElement | null = null;	// The root DOM reference containing the rendered folder framework drawer
    private dock: HTMLElement | null = null;	// The floating trigger handle injected globally into the document viewport edge
	private adapter: LeftSidebarAdapter | null; // Reference to the active site-specific adapter layer
	private AccountSettings: AccountSettings = DEFAULT_ACCOUNT_SETTINGS;
	private domainSettings: DomainSettings = DEFAULT_DOMAIN_SETTINGS;

	// Chat ids currently saved somewhere in the folder tree, used by the full-scan toggle
	private savedChatIds = new Set<string>();

	// Watches the whole document for DOM mutations, so lazily-loaded native
	// sidebar rows (initial hydration AND further items loaded on scroll)
	// get hidden/shown automatically, with no polling/timeout needed.
	private mutationObserver: MutationObserver | null = null;
	// Batches multiple mutation callbacks into a single DOM pass per animation frame.
	private applyScheduled = false;

	/**
     * Constructs the RightSidebar interface component.
     * @param {LeftSidebarAdapter | null} adapter - Platform operational binder link.
     */
    constructor(adapter: LeftSidebarAdapter | null) {
        this.adapter = adapter;
        this.init();
    }

	/**
     * Triggers sequential asynchronous boot sequences for core UI attachment routines.
     * @private
     * @returns {Promise<void>}
     */
    private async init(): Promise<void> {
        this.injectStyles();
        this.createDockTrigger();
        this.createPanel();
		this.bindDragEvents();

		this.AccountSettings = await FolderManager.getAccountSettings();
		this.domainSettings  = await FolderManager.getDomainSettings();
		this.watchDomainSettingsChanges();
		this.watchCloudSyncChanges();
		this.updateHideToggleUI();

        await this.refresh();

		// Start watching BEFORE the manual pass below. Any mutation that happens
		// in between (e.g. the native sidebar still hydrating) is never missed —
		// it just triggers another apply pass through the observer callback.
		this.startObservingNativeSidebar();
		this.applyHideToAllRows(); // handle whatever native rows are already in the DOM right now		
    }

/**
	 * Keeps the in-memory domainSettings cache in sync with the shared
	 * { td, snc } setting item, so toggles changed on the options page take
	 * effect immediately on already-open tabs, without a page refresh.
	 */
	private watchDomainSettingsChanges(): void {
		if (!this.adapter) return;
		const settingKey = FolderManager.getGlobalSettingStorageKey();
		const code = FolderManager.getPlatformCode(this.adapter.platformId);

		chrome.storage.onChanged.addListener((changes, areaName) => {
			if (areaName !== 'sync') return;
			const change = changes[settingKey];
			if (!change) return;

			const newSetting = { ...DEFAULT_GLOBAL_SETTING, ...(change.newValue || {}) };
			this.domainSettings = {
				enabled: code !== undefined ? newSetting.td.includes(code) : DEFAULT_DOMAIN_SETTINGS.enabled,
				syncNativeChanges: code !== undefined ? newSetting.snc.includes(code) : DEFAULT_DOMAIN_SETTINGS.syncNativeChanges,
			};
			console.log('[AIChatFolders] Domain settings updated live:', this.domainSettings);
		});
	}

	/**
	 * Re-renders from whichever store is currently active whenever something
	 * relevant changes on chrome.storage.sync from elsewhere:
	 * - the global `cs` toggle flips (options page, this device or another) —
	 *   this tab immediately starts reading from the other store, exactly as
	 *   if the toggle had been flipped locally,
	 * - the shared folder tree (`acf_folders`) changes on another device,
	 * - this platform+account's own chat-ref chunks change on another
	 *   device (`acf_c_{code}_{userId}_*`),
	 * - this platform+account's own AccountSettings item (e.g. hideChat)
	 *   changes on another device (`acf_s_{code}_{userId}`).
	 * Local and cloud are two independent stores (see FolderManager) — this
	 * only ever re-reads and re-renders, it never merges anything.
	 */
	private watchCloudSyncChanges(): void {
		if (!this.adapter) return;
		const settingKey = FolderManager.getGlobalSettingStorageKey();
		const code = FolderManager.getPlatformCode(this.adapter.platformId);
		const userId = this.adapter.getResolvedAccountKey();
		const chatKeyPrefix = code !== undefined && userId
			? `acf_c_${code}_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}_`
			: null;
		const accountSettingsKey = userId
			? FolderManager.getAccountSettingsSyncKey(this.adapter.platformId, userId)
			: null;

		chrome.storage.onChanged.addListener(async (changes, areaName) => {
			if (areaName !== 'sync') return;
			const accountSettingsChanged = accountSettingsKey ? !!changes[accountSettingsKey] : false;
			const relevant = !!changes[settingKey] || !!changes['acf_folders'] || accountSettingsChanged ||
				(chatKeyPrefix ? Object.keys(changes).some(k => k.startsWith(chatKeyPrefix)) : false);
			if (!relevant) return;

			// AccountSettings isn't part of refresh()'s own re-read (it only
			// pulls folders), so pick it up explicitly here. refresh() runs
			// first since applyHideToAllRows() below depends on the
			// freshly-rebuilt savedChatIds it populates.
			this.AccountSettings = await FolderManager.getAccountSettings();
			await this.refresh();
			this.updateHideToggleUI();
			this.applyHideToAllRows();
		});
	}

	/**
     * Injects custom standalone utility styling rules into the current runtime document environment head.
     * @private
     */
    private injectStyles(): void {
        if (document.getElementById('aichat-styles')) return;
        const style = document.createElement('style');
        style.id = 'aichat-styles';
        style.textContent = GlobalStyles;
        document.head.appendChild(style);
    }

	/**
     * Instantiates and mounts the viewport edge trigger toggle latch to the root document body.
     * @private
     */
    private createDockTrigger(): void {
        this.dock = document.createElement('div');
        this.dock.className = 'aichat-dock-trigger';
		if (this.adapter) {
			this.dock.classList.add(`aichat-dock-${this.adapter.platformId.toLowerCase()}`);
		}		
        this.dock.onclick = () => this.toggle(true);
        document.body.appendChild(this.dock);
    }

	/**
	 * Starts observing the whole document for DOM mutations. Started once and
	 * kept alive for the panel's whole lifetime; the callback itself decides
	 * whether there's actually anything to do.
	 */
	private startObservingNativeSidebar(): void {
		if (this.mutationObserver) return;
		this.mutationObserver = new MutationObserver(() => {
			if (!this.AccountSettings.hideChat) return; // nothing to do while the feature is off
			this.scheduleApplyHideToAllRows();
		});
		this.mutationObserver.observe(document.body, { childList: true, subtree: true });
	}

	/** Coalesces bursts of mutation events (e.g. many rows appearing at once) into one DOM pass. */
	private scheduleApplyHideToAllRows(): void {
		if (this.applyScheduled) return;
		this.applyScheduled = true;
		requestAnimationFrame(() => {
			try {
				this.applyHideToAllRows();
			} finally {
				this.applyScheduled = false; // reset after the pass finishes (or throws), not before
			}
		});
	}

	/**
     * Assembles core structural markup skeletons representing the persistent management node tray.
     * @private
     */
    private createPanel(): void {
        this.panel = document.createElement('div');
        this.panel.className = 'aichat-panel';
		this.panel.innerHTML = `
			<div class="aichat-header">
				<h2 style="color:white; margin:0; font-size:18px;">Chat Folder</h2>
				<div style="display: flex; gap: 12px; align-items: center;">
					<div id="aichat-toggle-hide-btn" class="aichat-header-btn" title="Hide chats already saved to a folder">
						${ICONS.EYE}
					</div>				
					<div id="add-folder-root" class="aichat-header-btn" title="Add New Top-level Folder">
						${ICONS.ADD_FOLDER_HEADER}
					</div>
					<div id="aichat-close-btn" class="aichat-header-btn" title="Close">
						${ICONS.CLOSE}
					</div>
				</div>
			</div>
			<div class="aichat-body" id="aichat-body">
				<div id="aichat-folder-list"></div>
			</div>
			<div class="aichat-footer" id="aichat-footer">
				<!-- Reserved for future feature area -->
			</div>
		`;
        document.body.appendChild(this.panel);
        this.bindGlobalEvents();
    }

	/*
     * Controls the layout presence configuration parameters of both the drawer canvas and the toggle anchor.
     * @param {boolean} open - Target state flag indicating true for presenting the pane layout.
     */
    public toggle(open: boolean): void {
        if (!this.panel || !this.dock) return;
        this.panel.classList.toggle('is-open', open);
        this.dock.classList.toggle('is-hidden', open);
    }

	/**
     * Sets up event delegation traps on the root panel node structure to streamline operational interactivity.
     * Handles routing shortcuts, item collapsing persistence, form dispatchers, and record purging hooks.
     * @private
     */
    private bindGlobalEvents(): void {

        this.panel?.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            
			// Intercept chat link anchor navigation targets to handle SPA smooth client transitions safely
			const chatLink = target.closest('.aichat-chat-anchor') as HTMLAnchorElement | null;
			if (chatLink) {
                const chatId = chatLink.dataset.chatId;
                if (chatId) {
                    e.preventDefault();
                    const url = this.adapter?.resolveChatUrl(chatId);
                    await this.adapter?.smoothNavigate(chatId, url ?? chatLink.href);
                }
                return;
			}

			// Parse toggle actions responsible for manipulating local folder visual expansions
			const folderIcon = target.closest('.toggle-folder') as HTMLElement;
			if (folderIcon) {
				const node = folderIcon.closest('.aichat-folder-node') as HTMLElement;
				if (node) {

					const subContainer = node.querySelector('.aichat-sub-container');
					if (!subContainer || subContainer.children.length === 0) return;

					const isCollapsed = node.classList.toggle('is-collapsed');
					const id = folderIcon.dataset.id;
					if (id) {
						const folders = await FolderManager.getFolders();
						const updateStatus = (list: FolderData[]): boolean => {
							for (const f of list) {
								if (f.id === id) {
									f.isCollapsed = isCollapsed;
									return true;
								}
								if (f.children && updateStatus(f.children)) return true;
							}
							return false;
						};
						updateStatus(folders);
						await FolderManager.saveFolders(folders);
						this.refresh(); // Refresh to update icon
					}
				}
				return;
			}

			// ✅ Click on folder card (but not on action buttons) to toggle expand/collapse
			const card = target.closest('.aichat-folder-card') as HTMLElement;
			if (card && !target.closest('.aichat-actions')) {
				const node = card.closest('.aichat-folder-node') as HTMLElement;
				if (node) {
					const subContainer = node.querySelector('.aichat-sub-container');
					if (subContainer && subContainer.children.length > 0) {
						// Toggle collapse state
						const isCollapsed = node.classList.toggle('is-collapsed');
						const id = card.dataset.id;
						if (id) {
							const folders = await FolderManager.getFolders();
							const updateStatus = (list: FolderData[]): boolean => {
								for (const f of list) {
									if (f.id === id) {
										f.isCollapsed = isCollapsed;
										return true;
									}
									if (f.children && updateStatus(f.children)) return true;
								}
								return false;
							};
							updateStatus(folders);
							await FolderManager.saveFolders(folders);
							this.refresh();
						}
					}
					return;
				}
			}			

			if (target.closest('#aichat-close-btn')) {
				this.toggle(false);
				return;
			}

            if (target.closest('#add-folder-root')) {
                this.showEditor(null);
            }

			const editBtn = target.closest('.edit-btn') as HTMLElement;
			if (editBtn) {
				const id = editBtn.dataset.id!;
				const folders = await FolderManager.getFolders();
				
				const folderToEdit = this.findFolderById(folders, id);
				
				if (folderToEdit) {
					this.showEditor(folderToEdit.parentId || null, folderToEdit);
				}
			}

			const addSub = target.closest('.add-sub-btn') as HTMLElement;
			if (addSub) {
				const folderId = addSub.dataset.id!;
				// The folder may be collapsed, which hides its children container via CSS.
				// Expand it first so the inline editor we're about to inject is actually visible.
				await FolderManager.expandFolder(folderId);
				await this.refresh();
				this.showEditor(folderId);
			}

			const delBtn = target.closest('.delete-btn') as HTMLElement;
			if (delBtn) {
				const id = delBtn.dataset.id!;
				const node = delBtn.closest('.aichat-folder-node') as HTMLElement;
				const isChatLeaf = node?.classList.contains('aichat-chat-leaf');
				// Pull the display name straight from the rendered card so the confirm
				// dialog can reference the actual item being deleted.
				const titleEl = node?.querySelector('.aichat-folder-title');
				const nodeName = (titleEl?.textContent || '').trim();
				if (isChatLeaf) {
					const parentNode = node.parentElement?.closest('.aichat-folder-node');
					const cardEl = parentNode?.querySelector('.aichat-folder-card');
					const parentId = cardEl instanceof HTMLElement ? cardEl.dataset.id : undefined;
					if (parentId && await this.showConfirmDialog(`Remove "${nodeName}" from the folder?\n(This will not delete your actual chat history)`)) {
						const updated = await FolderManager.deleteNode(id, parentId);
						this.render(updated);
						if (!this.chatExistsInTree(updated, id)) {
							this.savedChatIds.delete(id);
							if (this.AccountSettings.hideChat) this.showRowById(id); // truly gone — restore the native row
						}
					}
				} else {
					if (await this.showConfirmDialog(`Delete folder "${nodeName}" and all its sub-folders?\n(Chats inside will not be deleted from your actual chat history.)`)) {
						// Collect every chat id under this folder BEFORE deleting, so we know what to restore
						const folders = await FolderManager.getFolders();
						const target = this.findFolderById(folders, id);
						const chatIdsToRestore = target ? this.collectChatIds(target) : [];

						const updated = await FolderManager.deleteNode(id);
						this.render(updated);
						chatIdsToRestore.forEach(cid => {
							if (!this.chatExistsInTree(updated, cid)) {
								this.savedChatIds.delete(cid);
								if (this.AccountSettings.hideChat) this.showRowById(cid);
							}							
						}); // restore a batch of native rows
					}
				}
			}

			if (target.closest('#aichat-toggle-hide-btn')) {
				this.AccountSettings.hideChat = !this.AccountSettings.hideChat;
				await FolderManager.updateAccountSettings(this.AccountSettings);
				this.applyHideToAllRows(); // Full scan: loop every native row, decide hide/show
				this.updateHideToggleUI();
				return;
			}
        });

		// Add a safeguard to prevent duplicate event listener registration 
        // in case the content script is re-injected by the browser.
		if (!(window as any).__aichat_listener_attached) {
			window.addEventListener('aichat:save-to-folder', async (e: Event) => {
				const customEvent = e as CustomEvent<{ folderId: string; chatInfo: { id: string; title: string } }>;
				const { folderId, chatInfo } = customEvent.detail;

				if (!folderId || !chatInfo) return;

				// Save directly under current single platform logic
				await FolderManager.saveChatToFolder(folderId, chatInfo);
				this.toggle(true);
				await this.refresh();
				this.flashNode(chatInfo.id); 
				this.hideRowById(chatInfo.id); // NEW: hide this one native row (only if toggle is on)
			});

			window.addEventListener('aichat:native-change', async (e: Event) => {
				// Feature toggle: defaults to on, but users can disable it from settings
				// if they're ever worried about an incorrect automatic sync.
				if (!this.domainSettings.syncNativeChanges) return;
				const detail = (e as CustomEvent<{ chatId: string; type: NativeChangeType; newTitle?: string }>).detail;
				if (!detail?.chatId) return;

				switch (detail.type) {
					case 'delete': {
						const updated = await FolderManager.deleteNode(detail.chatId);
						this.render(updated);
						if (!this.chatExistsInTree(updated, detail.chatId)) {
							this.savedChatIds.delete(detail.chatId);
						}
						break;
					}
					case 'rename': {
						if (!detail.newTitle) break;
						const updated = await FolderManager.renameNode(detail.chatId, detail.newTitle);
						this.render(updated);
						break;
					}
				}
			});

			// Mark the listener as attached
            (window as any).__aichat_listener_attached = true;
		}
    }

	/**
     * Recursively traverses the tree schema layers to resolve a folder record matching a target key identifier.
     * @private
     * @param {FolderData[]} folders - Structured data set array containing active operational profiles.
     * @param {string} id - Explicit query lookup code key indicator.
     * @returns {FolderData | null} Resolution representation object pointer, or null if unlocatable.
     */
	private findFolderById(folders: FolderData[], id: string): FolderData | null {
		for (const folder of folders) {
			if (folder.id === id) return folder;
			if (folder.children && folder.children.length > 0) {
				const found = this.findFolderById(folder.children, id);
				if (found) return found;
			}
		}
		return null;
	}

	/**
     * Clears internal listing markers and triggers comprehensive re-injection sweeps into the structural UI container.
     * @param {FolderData[]} folders - Complete hierarchical folder configuration matrix.
     */
    public render(folders: FolderData[]): void {
        const list = document.getElementById('aichat-folder-list');
        if (!list) return;

        const rootFolders = folders.filter(f => !f.parentId);
        list.innerHTML = this.renderFolderTree(rootFolders, 0);
    }

	/**
     * Mounts or modifies inline form editor instances under contextual node hierarchies.
     * Supports branching generation creation modes and inline detail corrections.
     * @private
     * @param {string | null} parentId - Tracking context indicator referencing the parent tree depth.
     * @param {FolderData} [existingData] - Pre-existing folder payload entity used to differentiate update actions.
     */
	private showEditor(parentId: string | null, existingData?: FolderData): void {
		let container: HTMLElement | null;
		let referenceNode: Node | null = null;

		if (existingData) {
			// Edit mode: locate the card reference DOM node block currently targeted for adjustments
			const card = this.panel?.querySelector(`.aichat-folder-card[data-id="${existingData.id}"]`);
			const node = card?.closest('.aichat-folder-node') as HTMLElement;
			container = node?.parentElement as HTMLElement;
			referenceNode = node; // We'll insert at the current node's position
		} else {
			// Creation mode: append template anchors based on explicit target structural containers
			container = parentId 
				? document.getElementById(`children-of-${parentId}`) 
				: document.getElementById('aichat-folder-list');
			referenceNode = container?.firstChild || null;
		}

		if (!container || container.querySelector('.aichat-edit-card')) return;

		const form = FolderEditor.render(
			() => this.refresh(),
			() => { 
				form.remove();
				if (existingData) {
					(referenceNode as HTMLElement).style.display = 'block';
				}
			},
			parentId,
			existingData
		);

		if (existingData && referenceNode) {
			(referenceNode as HTMLElement).style.display = 'none';
			container.insertBefore(form, referenceNode);
		} else {
			container.insertBefore(form, referenceNode);
		}

		const input = form.querySelector('#new-folder-name') as HTMLInputElement | null;
		if (input) {
			// Provide localized grace intervals allowing complete client rendering tasks to resolve focus
			setTimeout(() => {
				input.focus();
				input.select();
			}, 50);
		}		
	}

	/**
     * Pulls structural storage parameters from core configurations and pushes updates downstream to view frameworks.
     */
    public async refresh(): Promise<void> {
        const folders = await FolderManager.getFolders();
        this.render(folders);
		this.savedChatIds = this.collectAllChatIds(folders);
    }

	private collectAllChatIds(folders: FolderData[]): Set<string> {
		const ids = new Set<string>();
		const walk = (list: FolderData[]) => {
			for (const f of list) {
				if (f.isChat) ids.add(f.id);
				if (f.children?.length) walk(f.children);
			}
		};
		walk(folders);
		return ids;
	}

	/**
     * Configures extensive persistent Drag-and-Drop lifecycle bindings to oversee tree structure mutations.
     * Employs strict boundary guards preventing inverted tree circular reference faults.
     * @private
     */
	private bindDragEvents(): void {
		let draggedId: string | null = null;
		let lastPotentialNode: HTMLElement | null = null;
		let currentTargetNode: HTMLElement | null = null;
		let dragEnterTimer: number | null = null;
		// tracks whether the native 'drop' event already committed the move,
		// so the 'dragend' fallback below doesn't run twice.
		let dropHandled = false;

		// Cleans up all temporary CSS classes used for highlighting drop zones
		const clearStyles = () => {
			this.panel?.querySelectorAll('.has-drop-before').forEach(n => 
				n.classList.remove('has-drop-before'));
			this.panel?.querySelectorAll('.drop-inside').forEach(c => 
				c.classList.remove('drop-inside'));	
			this.panel?.querySelectorAll('[data-drop-pos]').forEach(n => {
					delete (n as HTMLElement).dataset.dropPos;
    			});				
		};

		// Standardizes operational drag parameter attributes on transition end sequences
		const finalizeDrag = () => {
			if (dragEnterTimer) window.clearTimeout(dragEnterTimer);
            clearStyles();
            document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

            draggedId = null;
            lastPotentialNode = null;
            currentTargetNode = null;
		};

		// This is a verbatim copy of the original inline 'drop' handler body,
		// extracted only so both the normal 'drop' path and the 'dragend'
		// fallback (for hosts like DeepSeek that swallow 'drop') can call the
		// exact same logic. Nothing about the logic itself has changed.
		const commitMove = async (targetNode: HTMLElement | null, movingId: string | null) => {
			if (!targetNode || !movingId) {
				finalizeDrag();
				return;
			}

			const card = targetNode.querySelector('.aichat-folder-card') as HTMLElement;
			const targetId = card?.dataset.id;
			const isInside = card?.classList.contains('drop-inside');
			const isAfter = targetNode.dataset.dropPos === 'after';

			const draggedNode = document.querySelector('.dragging')?.closest('.aichat-folder-node');
			const isDraggingChat = draggedNode?.classList.contains('aichat-chat-leaf');

			// Determine whether the target node is still inside aichat-folder-list
			// (i.e., has not been dragged out of the container).
			const isStillInsideContainer = targetNode.closest('#aichat-folder-list') !== null;

			// Tear down visual UI configurations before launching storage mutation routines
			finalizeDrag();

			if (targetId && movingId !== targetId) {
				let position: 'before' | 'inside' | 'after' = 'before';
				if (isInside) position = 'inside';
				else if (isAfter) position = 'after';

				// The chat record must not be dragged outside of aichat-folder-list
				// (i.e. it must not lose its parent folder).
				if (isDraggingChat && !isStillInsideContainer) {
					return;
				}

				// NEW: A chat record must never become a root-level (top-level) node —
				// it must always belong to some folder. Dropping it "before"/"after"
				// a root-level folder would set its parentId to null, orphaning it
				// outside any folder. Only block this when the drop would actually
				// land at root level; dropping "inside" a root folder is still fine.
				if (isDraggingChat && position !== 'inside') {
					const folders = await FolderManager.getFolders();
					const targetNodeData = this.findFolderById(folders, targetId);
					const targetIsRootLevel = !targetNodeData || !targetNodeData.parentId;
					if (targetIsRootLevel) {
						return;
					}
				}

				await FolderManager.reorder(movingId, targetId, position);

				window.requestAnimationFrame(() => {
					this.refresh();
				});
			}
		};

		// Start dragging the card
		this.panel?.addEventListener('dragstart', (e) => {
			const target = e.target as HTMLElement;
			const card = target.closest('.aichat-folder-card') as HTMLElement;
			if (!card) return;

			draggedId = card.dataset.id || null;
			dropHandled = false;
			card.classList.add('dragging');
			
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text/plain', draggedId || '');
			}
		});

		// Manage placeholder logic when entering a node
		this.panel?.addEventListener('dragenter', (e) => {

			const card = (e.target as HTMLElement).closest('.aichat-folder-card') as HTMLElement;
            if (!card) return;

            const node = card.closest('.aichat-folder-node') as HTMLElement;
            if (!node || node === lastPotentialNode) return;

            if (card.dataset.id === draggedId) return;

			const draggedNode = document.querySelector('.dragging')?.closest('.aichat-folder-node');

			// Defensive Rule: A parent folder structural segment cannot be dropped into itself or its own nested descendants
			if (draggedNode && node && draggedNode.contains(node)) {
				clearStyles();
				return;
			}

			// Optimization bypass: Skip updates if checking adjacent layout segments immediately following
			const draggedElement = document.querySelector('.dragging')?.closest('.aichat-folder-node');
			if (draggedElement && draggedElement.nextElementSibling === node) {
				clearStyles();
				lastPotentialNode = node;
				currentTargetNode = node;
				return;
			}

			lastPotentialNode = node;
			if (dragEnterTimer) window.clearTimeout(dragEnterTimer);

			// Debounce processing tracks to suppress visual layout flickering spikes during transition events
			dragEnterTimer = window.setTimeout(() => {
				if (lastPotentialNode === node) {
					clearStyles();
					node.classList.add('has-drop-before');
					currentTargetNode = node;
				}
				dragEnterTimer = null;
			}, 100);
		});

		this.panel?.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (!currentTargetNode) return;

			// Terminal leaf nodes (chats) cannot act as containers for other folders/chats
			if (currentTargetNode.classList.contains('aichat-chat-leaf')) {
				return;
			}

			const card = currentTargetNode.querySelector('.aichat-folder-card') as HTMLElement;
			const rect = card.getBoundingClientRect();

			// Calculate the Y coordinate of the mouse relative to the card's top edge
			const relY = e.clientY - rect.top;
			const height = rect.height;

			// Determine drop placement based on cursor vertical position:
			// Top 20%    -> BEFORE target
            // Middle 60% -> INSIDE target
            // Bottom 20% -> AFTER target			
			const isInside = relY > height * 0.2 && relY < height * 0.8;
			const isAfter = relY >= height * 0.8;
			const isLast = !currentTargetNode.nextElementSibling;

			card.classList.toggle('drop-inside', isInside);

			if (isLast) {
				if (isAfter) {
					currentTargetNode.dataset.dropPos = 'after';
					currentTargetNode.classList.remove('has-drop-before');

				} else if (currentTargetNode.dataset.dropPos === 'after' && relY <= height * 0.2) {
					delete currentTargetNode.dataset.dropPos;
					currentTargetNode.classList.toggle('has-drop-before', relY <= height * 0.2);
				}
			}
		});

		this.panel?.addEventListener('drop', async (e) => {
			e.preventDefault();
			dropHandled = true;
			await commitMove(currentTargetNode, draggedId);
		});

		this.panel?.addEventListener('dragend', () => {
			// Fallback: on hosts like DeepSeek, the native 'drop' event never
			// reaches this.panel (confirmed via console logging), so 'drop' above
			// never runs. 'dragend' always fires regardless, so run the identical
			// commitMove logic here using the last known drag state.
			// No 'else' branch needed here — commitMove() already calls
			// finalizeDrag() internally on every path (both the early-return guard
			// and the normal success path), so when 'drop' already ran there's
			// nothing left to clean up.
			if (!dropHandled) {
				void commitMove(currentTargetNode, draggedId);
			}
		});
	}

	/**
	 * Briefly flashes the target card to draw the user's eye to something
	 * that was just added (e.g. a newly saved chat).
	 * @private
	 * @param {string} id - data-id of the target folder-card element.
	 */
	private flashNode(id: string): void {
		const card = this.panel?.querySelector(`.aichat-folder-card[data-id="${id}"]`) as HTMLElement | null;
		if (!card) return;
		// In case the panel content overflows, make sure the new item is actually in view.
		card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		// Force a reflow so re-adding the class restarts the animation cleanly,
		// even if this same id was flashed a moment ago.
		card.classList.remove('aichat-just-added');
		void card.offsetWidth;
		card.classList.add('aichat-just-added');
		card.addEventListener('animationend', () => {
			card.classList.remove('aichat-just-added');
		}, { once: true });
	}

	/**
     * Recursively parses tree node parameters down into validated HTML templates.
     * Dispatches proper layouts based on node behavior (abstract containers vs chat leaf markers).
     * @private
     * @param {FolderData[]} folders - Active nested segment structure array.
     * @param {number} level - Numeric matrix tracking current parsing recursion depth.
     * @returns {string} Compiled structural string markup template.
     */
	private renderFolderTree(folders: FolderData[], level: number): string {
		return folders.map(folder => {
			const hasChildren = folder.children && folder.children.length > 0;
			const isCollapsed = !!folder.isCollapsed;
			const collapseClass = isCollapsed ? 'is-collapsed' : '';

			// Render branch leaf instances representing mapped native chat history items
			if (folder.isChat) {
				const targetChatId = folder.id;
				let dynamicUrl = '#';
				if (this.adapter) {
					dynamicUrl = this.adapter.resolveChatUrl(targetChatId);
				}
				
				return `
				<div class="aichat-folder-node aichat-chat-leaf" data-id="${folder.id}">
					<div class="aichat-folder-card aichat-chat-card" data-id="${folder.id}" draggable="true">
						<div class="aichat-folder-header">
							<span class="aichat-folder-title">
								<a href="${dynamicUrl}" class="aichat-chat-anchor" title="${folder.name}" target="_blank" data-chat-id="${targetChatId}">
									${folder.name}
								</a>
							</span>
							<div class="aichat-actions">
								<span class="delete-btn" data-id="${folder.id}">${ICONS.TRASH}</span>
							</div>
						</div>
					</div>
				</div>
				`;
			}

			// Inside the folder rendering section
			const iconClass = hasChildren ? 'aichat-folder-icon colored toggle-folder' : 'aichat-folder-icon toggle-folder';
			const glowStyle = hasChildren ? `style="--glow-color: ${resolveColor(folder.color)};"` : '';
			const folderIcon = (isCollapsed || !hasChildren) ? ICONS.FOLDER_CLOSED : ICONS.FOLDER_OPEN;

			return `
			<div class="aichat-folder-node ${collapseClass}" style="--glow-color: ${resolveColor(folder.color)};">
				<div class="aichat-folder-card" data-id="${folder.id}" draggable="true"
					style="border-left: 4px solid ${resolveColor(folder.color)};">
					<div class="aichat-folder-header">
						<span class="aichat-folder-title">
							<span class="${iconClass}" data-id="${folder.id}" ${glowStyle}>
								${folderIcon}
							</span>
							<span>${folder.name}</span>
						</span>
						<div class="aichat-actions">
							<span class="edit-btn" data-id="${folder.id}">${ICONS.EDIT}</span>
							<span class="add-sub-btn" data-id="${folder.id}">${ICONS.PLUS}</span>
							<span class="delete-btn" data-id="${folder.id}">${ICONS.TRASH}</span>
						</div>
					</div>
				</div>
				<div class="aichat-sub-container" id="children-of-${folder.id}">
					${this.renderFolderTree(folder.children || [], level + 1)}
				</div>
			</div>
			`;


		}).join('');
	}

	/** Hides a single native sidebar row by chat id, only when the toggle is currently on. */
	private hideRowById(chatId: string): void {
		if (!this.AccountSettings.hideChat) return;
		const row = this.adapter?.getChatRowById(chatId);
		row?.classList.add(NATIVE_HIDDEN_CLASS);
	}

	/** Restores a single native sidebar row by chat id. Safe to call even if it wasn't hidden. */
	private showRowById(chatId: string): void {
		const row = this.adapter?.getChatRowById(chatId);
		row?.classList.remove(NATIVE_HIDDEN_CLASS);
	}

	/** Full scan: walks every currently rendered native row and hides/shows it based on current settings. */
	private applyHideToAllRows(): void {
		if (!this.adapter) return;
		this.adapter.getChatRows().forEach(({ chatId, row }) => {
			const shouldHide = this.AccountSettings.hideChat && this.savedChatIds.has(chatId);
			row.classList.toggle(NATIVE_HIDDEN_CLASS, shouldHide);
		});
	}

	/** Recursively collects every chat leaf id under a given folder node (including itself if it's a chat). */
	private collectChatIds(node: FolderData): string[] {
		const ids: string[] = [];
		const walk = (n: FolderData) => {
			if (n.isChat) ids.push(n.id);
			(n.children || []).forEach(walk);
		};
		walk(node);
		return ids;
	}

	/** Syncs the header button's visual "active" state with the current toggle value. */
	private updateHideToggleUI(): void {
		const btn = this.panel?.querySelector('#aichat-toggle-hide-btn');
		if (!btn) return;
		btn.classList.toggle('is-active', this.AccountSettings.hideChat);
		btn.innerHTML = this.AccountSettings.hideChat ? ICONS.EYE_OFF : ICONS.EYE;
		btn.setAttribute('title', this.AccountSettings.hideChat
			? 'Show all chats in the native sidebar'
			: 'Hide chats already saved to a folder');
	}

	/** Checks whether a given chat id still exists anywhere in the folder tree. */
	private chatExistsInTree(folders: FolderData[], chatId: string): boolean {
		for (const f of folders) {
			if (f.isChat && f.id === chatId) return true;
			if (f.children?.length && this.chatExistsInTree(f.children, chatId)) return true;
		}
		return false;
	}

	/**
	 * Renders a custom in-DOM confirmation modal and resolves once the user responds.
	 * `window.confirm()` is unreliable inside some embedded browsing contexts (e.g. Vivaldi's
	 * side panel), where the host silently suppresses native blocking dialogs instead of
	 * showing them — this replaces it entirely so the confirmation always renders.
	 * @private
	 * @param {string} message - The prompt text to display inside the modal body.
	 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled/dismissed.
	 */
	private showConfirmDialog(message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const overlay = document.createElement('div');
			overlay.className = 'aichat-confirm-overlay';

			const card = document.createElement('div');
			card.className = 'aichat-confirm-card';

			if (this.adapter) {
            	card.classList.add(`aichat-confirm-${this.adapter.platformId.toLowerCase()}`);
        	}

			const titleEl = document.createElement('div');
			titleEl.className = 'aichat-confirm-title';
			titleEl.textContent = 'AI Chat Folders';
			card.appendChild(titleEl);

			const messageEl = document.createElement('div');
			messageEl.className = 'aichat-confirm-message';
			// Use textContent (not innerHTML) so folder/chat names containing
			// HTML-special characters can never be interpreted as markup.
			messageEl.textContent = message;
			card.appendChild(messageEl);

			const btnGroup = document.createElement('div');
			btnGroup.className = 'aichat-btn-group';
			btnGroup.innerHTML = `
			<button class="aichat-btn btn-cancel">Cancel</button>
			<button class="aichat-btn btn-danger">Delete</button>
			`;
			card.appendChild(btnGroup);
			overlay.appendChild(card);
			document.body.appendChild(overlay);

			const cleanup = (result: boolean) => {
				document.removeEventListener('keydown', onKeydown);
				overlay.remove();
				resolve(result);
			};
			const onKeydown = (e: KeyboardEvent) => {
				if (e.key === 'Escape') cleanup(false);
			};
			document.addEventListener('keydown', onKeydown);
			// Clicking the dimmed backdrop (outside the card) cancels, mirroring native confirm's dismiss behavior
			overlay.addEventListener('click', (e) => {
				if (e.target === overlay) cleanup(false);
			});
			btnGroup.querySelector('.btn-cancel')?.addEventListener('click', () => cleanup(false));
			btnGroup.querySelector('.btn-danger')?.addEventListener('click', () => cleanup(true));
		});
	}
}