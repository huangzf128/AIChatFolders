/**
 * @file LeftSidebarAdapter.ts
 * @description Base abstract class defining the contract for site-specific AI platform sidebar adaptations.
 * Provides shared capabilities including DOM mutation monitoring and multi-level cascade menu management.
 */

import type { NativeChangeType } from '../models/Folder';

/**
 * Abstract adapter that bridges the application core with specific AI platform UIs (e.g., Gemini, ChatGPT).
 * Subclasses must implement site-specific selectors, ingestion hooks, and routing handlers.
 */
export abstract class LeftSidebarAdapter {
    abstract platformId: string;	// Unique identifier string for the target AI platform (e.g., 'gemini', 'chatgpt')
    abstract itemSelector: string;	// DOM selector string used to target individual chat list items in the native sidebar
    protected closeTimer: any = null;	// Reference identifier for the delayed menu closure timer mechanism

	// ── Native sidebar row lookup ──────────────────────────────────────────
	// All four platforms share the same "container → rows → link → chatId"
	// shape, so the traversal logic lives here once; subclasses only declare
	// the three selectors below.

	/**
	* CSS selector for the container(s) holding the native chat list.
	* querySelectorAll is used (not querySelector), because some platforms
	* render multiple independent sections — e.g. Claude's "Starred" and
	* "Recents" are two separate <ul class="flex flex-col"> elements.
	*/
	protected abstract historySelector: string;

	/**
	* CSS selector (relative to the container) identifying a single row.
	* Most platforms wrap the link in a non-anchor element (e.g. 'li', a
	* custom tag). For platforms where the row IS the anchor itself
	* (e.g. DeepSeek), set this to the same value as `linkSelector`.
	*/
	protected abstract rowSelector: string;

	/**
	* CSS selector identifying the chat's anchor link — either the row
	* itself or a descendant of it. Must match a URL whose LAST path
	* segment is the chat id (e.g. 'a[href*="/c/"]').
	*/
	protected abstract linkSelector: string;

	/**
     * Shared state to temporarily cache the target chat metadata.
     * Populated by the initClickListener before the native context menu renders.
     * @protected
     */
    protected currentTargetChat: { id: string; title: string } | null = null;

	/**
   	* Cached unique identifier for the currently logged-in user.
   	* @protected
   	*/
    protected accountKey: string | null = null;

	/**
	 * Explicitly initializes DOM listeners and UI injection for the adapter.
	 * This should only be called after confirming the user is logged in.
	 */
	abstract init(): void;

	/**
	 * Scrapes and returns the unique user identifier (e.g., email or account ID) for the current platform session.
	 * Must be implemented by all site-specific adapters.
	 * NOTE: Changed to async because some platforms (e.g. DeepSeek) require a network
	 * request to fetch the current user info, which cannot be done synchronously.
	 * @abstract
	 * @returns {Promise<string | null>} Unique user identifier string, or null if the user is not logged in.
	 */
	abstract getAccountKey(): Promise<string | null>;

	/**
	 * Synchronously reads the already-resolved user id.
	 * Call this AFTER getAccountKey() has been awaited once (e.g. during app startup in content.ts).
	 * No Promise involved — just a plain field read, safe to call anywhere downstream (e.g. FolderManager).
	 * @returns {string | null}
	 */
	public getResolvedAccountKey(): string | null {
		return this.accountKey;
	}

	/**
     * Initializes global click listeners to capture chat metadata (ID and Title) 
     * exactly when the user clicks the native options button.
     * This contract must be implemented by all child adapters.
     * @protected
     */
    protected abstract initClickListener(): void;
	
	/**
	 * Listens for a native-chat-change report from a platform's MAIN-world
	 * bridge script (e.g. claude-main-bridge.ts) and re-broadcasts it as the
	 * shared, platform-agnostic `aichat:native-change` event that RightSidebar
	 * already knows how to handle.
	 *
	 * This lives here (not per-adapter) because the logic is identical for
	 * every platform — it only depends on the two agreed-upon event names and
	 * a `{ chatId, type, ...extra }` payload shape, not on any platform-
	 * specific DOM/selector details. Subclasses whose platform has a
	 * MAIN-world bridge that dispatches `aichatfolders:conversation-changed`
	 * just need to call this once from their own `init()`.
	 * @protected
	 */
	protected initNativeChatSync(): void {
		window.addEventListener('aichatfolders:conversation-changed', (e: Event) => {
			const detail = (e as CustomEvent<{ chatId: string; type: NativeChangeType; newTitle?: string }>).detail;
			if (!detail?.chatId || !detail.type) return;
			window.dispatchEvent(new CustomEvent('aichat:native-change', { detail }));
		});
	}

	/**
     * Creates, positions, and manages the operational lifecycle of a multi-level cascading folder menu.
     * @protected
     * @param {number} x - Target horizontal page coordinate for anchor positioning.
     * @param {number} y - Target vertical page coordinate for anchor positioning.
     * @param {any[]} folders - Layer segments of the folder tree structure to render.
     * @param {number} [level=0] - Current absolute depth of the nested cascade layer.
     */
	protected showLevelMenu(x: number, y: number, folders: any[], level: number = 0): void {
		if (level === 0) this.removeCascadeMenus();

		const pureFolders = (folders || []).filter(f => !f.isChat);
		if (pureFolders.length === 0 && level > 0) return;

		const menu = document.createElement('div');
		menu.className = `aichat-cascade-menu level-${level}`;

		menu.addEventListener('mouseenter', () => this.clearCloseTimer());
		menu.addEventListener('mouseleave', () => this.startCloseTimer());

		pureFolders.forEach(folder => {
			const item = document.createElement('div');
			item.className = 'aichat-cascade-item';
			const hasChildren = folder.children && folder.children.some((c: any) => !c.isChat);

			item.innerHTML = `
				<span>${folder.name}</span>
				${hasChildren ? '<span style="font-size: 10px; margin-left:2px;">▶</span>' : ''}
			`;

			item.addEventListener('click', async (e) => {
				e.stopPropagation();
				const info = this.getChatInfo();
				window.dispatchEvent(new CustomEvent('aichat:save-to-folder', {
					detail: { folderId: folder.id, chatInfo: info }
				}));
				this.removeCascadeMenus();
				this.closeNativeMenu();
				// This interaction cycle is fully consumed at this point (info has
				// already been read and dispatched), so drop the cache here rather
				// than relying on some other click handler to invalidate it later.
				this.currentTargetChat = null;
			});

			if (hasChildren) {
				item.addEventListener('mouseenter', () => {
					this.clearCloseTimer();
					const rect = item.getBoundingClientRect();
					// Pass pre-filtered child slices to prevent redundant calculation cycles
					const childFolders = folder.children.filter((c: any) => !c.isChat);
					this.showLevelMenu(rect.right, rect.top, childFolders, level + 1);
				});
			} else {
				item.addEventListener('mouseenter', () => {
					this.clearCloseTimer();
					this.removeSubMenus(level);
				});
			}
			menu.appendChild(item);
		});

		document.body.appendChild(menu);

		// UI Boundary calculation safeguards: Adjust constraints if elements exceed current viewport boundaries
		const menuHeight = menu.offsetHeight;
		const viewportHeight = window.innerHeight;
		const padding = 10;

		let adjustedY = y;
		if (y + menuHeight > viewportHeight - padding) {
			adjustedY = Math.max(padding, viewportHeight - menuHeight - padding);
		}

		// 💡 Also check right boundary (prevent overflow on the right)
		const menuWidth = menu.offsetWidth;
		const viewportWidth = window.innerWidth;
		let adjustedX = x;
		if (x + menuWidth > viewportWidth - padding) {
			adjustedX = Math.max(padding, viewportWidth - menuWidth - padding);
		}

		menu.style.top = `${adjustedY}px`;
		menu.style.left = `${adjustedX}px`;
	}

	/**
	 * Dismisses the native platform's own dropdown/context menu that our
	 * cascade menu is anchored inside. Default: simulate a real Escape
	 * keypress, which almost every accessible menu/overlay listens for.
	 * Dispatch on document.body (not document) — an event's propagation
	 * path only includes the target's ANCESTORS, and body is document's
	 * descendant, not its ancestor, so dispatching on document never
	 * reaches a body-bound listener.
	 * @protected
	 * @virtual
	 */
	protected closeNativeMenu(): void {
		document.body.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'Escape', code: 'Escape', keyCode: 27, which: 27,
			bubbles: true, cancelable: true,
		}));
	}

	/**
     * Starts the delayed grace-period timer before tearing down active popup menu nodes.
     * @protected
     */
    protected startCloseTimer(): void {
        this.clearCloseTimer();
        this.closeTimer = setTimeout(() => this.removeCascadeMenus(), 300);
    }

	/**
     * Annuls the pending destruction sequence timer to maintain UI menu tree presentation.
     * @protected
     */
    protected clearCloseTimer(): void {
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
    }

	/**
     * Purges all custom cascading context menu components from the active global DOM document.
     * @protected
     */
    protected removeCascadeMenus(): void {
        document.querySelectorAll('.aichat-cascade-menu').forEach(el => el.remove());
    }

	/**
     * Prunes subset nested menu clusters stretching beyond a designated hierarchical matrix tier.
     * @protected
     * @param {number} currentLevel - The absolute index depth threshold boundary.
     */
    protected removeSubMenus(currentLevel: number): void {
        document.querySelectorAll('.aichat-cascade-menu').forEach(menu => {
            const level = parseInt(menu.className.match(/level-(\d+)/)?.[1] || "0");
            if (level > currentLevel) menu.remove();
        });
    }

    /**
     * Scrapes and extracts structural chat telemetry from a targeted native DOM element.
     * @abstract
     * @returns {{ id: string; title: string; url: string }} Extracted safe metadata representing the active chat.
     */
    abstract getChatInfo(): { id: string; title: string; url: string };

	/**
     * Compiles a standard raw conversation identifier into a full, navigable platform hyperlink.
     * @abstract
     * @param {string} chatId - The unique native session identifier string.
     * @returns {string} Fully structured routing address URL bound to the target stream.
     */
    abstract resolveChatUrl(chatId: string): string;

	/**
     * Orchestrates decoupled soft client navigation for Single Page Application (SPA) layout engines.
     * Falls back gracefully to explicit full location reloads if specialized handling isn't provided.
     * @virtual
     * @param {string} chatId - Target transaction thread metadata key.
     * @param {string} fallbackUrl - The complete destination URL structure backup.
     * @returns {Promise<void>}
     */
    async smoothNavigate(chatId: string, fallbackUrl: string): Promise<void> {
        // Default: full page reload
        window.location.href = fallbackUrl;
    }

	/** Returns every chat row currently rendered in the native sidebar, paired with its chat id. */
	public getChatRows(): { chatId: string; row: HTMLElement }[] {
		const containers = document.querySelectorAll<HTMLElement>(this.historySelector);
		const result: { chatId: string; row: HTMLElement }[] = [];
		containers.forEach(container => {
			container.querySelectorAll<HTMLElement>(this.rowSelector).forEach(row => {
				const chatId = this.extractChatIdFromRow(row);
				if (chatId) result.push({ chatId, row });
			});
		});
		return result;
	}

	/** Finds the native sidebar row for a specific chat id, or null if it isn't rendered yet. */
	public getChatRowById(chatId: string): HTMLElement | null {
		return this.getChatRows().find(item => item.chatId === chatId)?.row ?? null;
	}

	/** Extracts the chat id from a row's anchor link (which may be the row itself). */
	private extractChatIdFromRow(row: HTMLElement): string {
		const link = (row.matches(this.linkSelector) ? row : row.querySelector(this.linkSelector)) as HTMLAnchorElement | null;
		return link?.getAttribute('href')?.split('/').pop() || '';
	}

}