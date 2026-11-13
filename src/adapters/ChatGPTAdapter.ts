/**
 * @file ChatGPTAdapter.ts
 * @description Implementation for OpenAI ChatGPT. Handles native menu injection
 * and custom SPA (Single Page Application) navigation logic.
 */
import { LeftSidebarAdapter } from './LeftSidebar';
import { ICONS } from '../ui/icons';
import { FolderManager } from '../models/FolderManager';

export class ChatGPTAdapter extends LeftSidebarAdapter {
    platformId = 'chatgpt';
    // Target selector for ChatGPT's native popover action menu
    itemSelector = 'div[role="menu"]';
	// The native menu container the current "Add to Folder" item lives in.
	// The cascade menu is inserted as its sibling so it shares the exact same
	// ancestor chain (and therefore the same clipping / stacking context) as
	// ChatGPT's own submenus.
	private currentMenuContainer: HTMLElement | null = null;
	protected override historySelector = '#app-shell-sidebar, #browser-sidebar-popover';
	protected override scrollContainerSelector = 'div[data-app-action-sidebar-scroll]';
	protected override rowSelector = 'div[role="listitem"]';
	protected override linkSelector = 'a[href*="/c/"]';

	protected override collapseContainerSelector = 'div[data-app-shell-active-page="true"] div[data-chatgpt-conversation-selection-target]';
	protected override collapseTurnSelector = 'div[data-chatgpt-search-unit-key$=":user"]';
	protected override collapseResponseSelector = 'div[data-chatgpt-search-unit-key$=":assistant"]';

	constructor() {
        super();
    }

	/**
	 * Invoked only after user authentication is confirmed in content.ts
	 */
	public init(): void {
		this.initClickListener();
		this.initNativeChatSync();
		this.initCollapseClickListener();
		this.initConversationChangeListener();
	}

	/**
	 * Listens for SPA conversation changes and removes all collapse anchors.
	 * ChatGPT caches conversation DOM; without cleanup, a stale anchor on a
	 * cached (non-active) container would keep it collapsed when revisited.
	 */
	private initConversationChangeListener(): void {
		window.addEventListener('aichatfolders:conversation-changed', () => {
			document.querySelectorAll('.ai-chat-folder-anchor')
				.forEach(el => el.classList.remove('ai-chat-folder-anchor'));
		});
	}

	/**
	 * Adds .ai-chat-folder-anchor on the active conversation container.
	 * CSS folds all but the last turn via :not(:last-child). The last
	 * assistant response is also collapsed directly so the user sees
	 * immediate feedback even on long final replies.
	 * Clears stale anchors from cached (non-active) containers first.
	 */
	public override collapseOldChats(): void {
		document.querySelectorAll('.ai-chat-folder-anchor')
			.forEach(el => el.classList.remove('ai-chat-folder-anchor'));

		const chatId = window.location.pathname.split('/').pop();
		if (!chatId) return;

		const selector = `div[data-app-shell-active-page="true"] div[data-chatgpt-conversation-selection-target="${chatId}"]`;
		const container = document.querySelector(selector);
		if (!container) return;

		container.classList.add('ai-chat-folder-anchor');

		const assistants = container.querySelectorAll(this.collapseResponseSelector!);
		const lastAssistant = assistants[assistants.length - 1];
		if (lastAssistant) {
			lastAssistant.classList.add('ai-chat-folder-collapsed');
		}
	}

    protected createMenuItem(trigger?: HTMLElement): void {

		// The menu is rendered inside the clicked chat row, so resolve it from the
		// click target. A global querySelector would hit the first of many rows.
		const row = trigger?.closest<HTMLElement>(this.rowSelector) ?? null;
		const menuContainer = row?.querySelector<HTMLElement>(this.itemSelector) ?? null;

		// Skip if menu not found or button already exists
		if (!menuContainer || menuContainer.querySelector('.aichat-folder-menu-item')) return;

        // Find an existing menu item to clone its classes for consistent styling
        const originalItem = menuContainer.querySelector('[role="menuitem"]');
        if (!originalItem) return;

        const button = document.createElement('div');
        // Copy original classes to inherit ChatGPT's dark/light mode styles
        button.className = originalItem.className + ' aichat-folder-menu-item';
        button.setAttribute('role', 'menuitem');
        button.style.cursor = 'pointer';
        button.innerHTML = `
			<div data-menu-row-content="true" class="flex w-full items-center gap-[var(--spacing-menu-item-content,calc(var(--spacing)*1.5))]">
				<span class="min-w-0 flex-1 truncate">
					<span class="flex w-full items-center gap-1.5">
						<span class="leadingIcon-nJYd0H">${ICONS.GPT_MENU_ADD_FOLDER}</span>
						<span class="truncate">Add to Folder</span>
					</span>
				</span>
				<svg data-rtl-flip="" aria-hidden="true" class="Icon-X4VkKC text-tertiary" focusable="false" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><use href="/cdn/assets/icons-fac34c1b33b86f8f.svg#chevron-right-md-light-16" fill="currentColor"></use></svg>
			</div>
        `;

        // Inject before the "Delete" item if possible, which is usually last
        menuContainer.appendChild(button);
		this.currentMenuContainer = menuContainer;

		// Some rows (e.g. chats inside a project) mount extra native items AFTER
		// our injection, which pushes our item upward. Keep it pinned to the end
		// for as long as it stays connected. Our own cascade menu is excluded
		// from the comparison, otherwise it would look like we are never last
		// and the observer would append on every mutation.
		const pinLast = new MutationObserver(() => {
			if (!button.isConnected) {
				pinLast.disconnect();
				return;
			}
			const lastNative = Array.from(menuContainer.children)
				.filter((el) => !el.classList.contains('aichat-cascade-menu'))
				.pop();
			if (lastNative !== button) {
				menuContainer.appendChild(button);
			}
		});
		pinLast.observe(menuContainer, { childList: true });

		button.addEventListener('mouseenter', async () => {

			button.setAttribute('data-state', 'open');
			
			this.clearCloseTimer();
			const rect = button.getBoundingClientRect();
			const folders = await FolderManager.getFolders();
			this.showLevelMenu({ left: rect.left, right: rect.right, top: rect.top }, folders);
		});

		button.addEventListener('mouseleave', () => {
			button.removeAttribute('data-state');
			this.startCloseTimer();
		});		
    }

	protected override insertCascadeMenu(menu: HTMLElement): void {
		const level = parseInt(menu.className.match(/level-(\d+)/)?.[1] || '0');

		// Every level stays inside ChatGPT's own menu container so that all of
		// them share the exact same ancestor chain (and stacking context) as
		// ChatGPT's native submenus. Mounting deeper levels on #browser-sidebar-popover
		// puts them back under the clipped/contained sidebar, which is why they
		// used to be covered by the native menu.
		if (this.currentMenuContainer?.isConnected) {
			if (level === 0) {
				this.currentMenuContainer.appendChild(menu);
				return;
			}
			const parentLevel = this.currentMenuContainer.querySelector<HTMLElement>(
				`.aichat-cascade-menu.level-${level - 1}`
			);
			if (parentLevel) {
				parentLevel.appendChild(menu);
				return;
			}
		}

		const popover = document.querySelector('#browser-sidebar-popover');
		if (popover) {
			popover.appendChild(menu);
		} else {
			document.body.appendChild(menu);
		}
	}

    getChatInfo() {

		if (this.currentTargetChat) {
            return {
                id: this.currentTargetChat.id,
                title: this.currentTargetChat.title,
                url: this.resolveChatUrl(this.currentTargetChat.id)
            };
        }

        // ChatGPT encodes conversation ID in the URL: /c/uuid
        const pathParts = window.location.pathname.split('/');
        const chatId = pathParts[pathParts.length - 1];
        
        // ChatGPT's sidebar active item title
        const activeChatEl = document.querySelector('#app-shell-sidebar a[aria-current="page"] span');
        const titleText = activeChatEl?.textContent || document.title;

        return {
            id: chatId || Date.now().toString(),
            title: titleText.trim(),
            url: window.location.href
        };
    }

	/**
     * Resolves raw identifier strings back into functional navigation paths.
     * USING RELATIVE PATHS: This is crucial for history.pushState to avoid cross-origin reload blocks.
     */
    resolveChatUrl(chatId: string): string {
        return `https://chatgpt.com/c/${chatId}`;
    }

	async getAccountKey(): Promise<string | null> {
		if (this.accountKey) {
			return this.accountKey;
		}

		const script = document.getElementById("client-bootstrap");

		if (!script) {
			return null;
		}

		try {
			const data = JSON.parse(script.textContent ?? "");

			this.accountKey =
				data?.session?.account?.id ??
				data?.session?.user?.id ??
				data?.session?.user?.email ??
				null;

			return this.accountKey;
		} catch (e) {
			console.warn("[AIChatFolders] Parse client-bootstrap failed.", e);
			return null;
		}
	}

}