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
    itemSelector = '[role="menu"] > div[role="group"]:last-child';
	protected override historySelector = '#history';
	protected override scrollContainerSelector = 'nav[data-scrolled-from-end]';
	protected override rowSelector = 'li';
	protected override linkSelector = 'a[href*="/c/"]';

	constructor() {
        super();
    }

	/**
	 * Invoked only after user authentication is confirmed in content.ts
	 */
	public init(): void {
		this.initClickListener();
		this.initNativeChatSync();
	}

    protected createMenuItem(): void {

		const menuContainer = document.querySelector(this.itemSelector);
			
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
			<div class="flex min-w-0 items-center gap-1.5">
				<div class="relative flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon">${ICONS.GPT_MENU_ADD_FOLDER}</div>
            	<span>Add to Folder</span>
			</div>
			<span style="font-size: 10px; opacity: 0.5;">▶</span>
        `;

        // Inject before the "Delete" item if possible, which is usually last
        menuContainer.appendChild(button);

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
        const activeChatEl = document.querySelector('#history a[data-active] div.truncate span');
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