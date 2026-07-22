/**
 * @file ChatGPTAdapter.ts
 * @description Implementation for OpenAI ChatGPT. Handles native menu injection
 * and custom SPA (Single Page Application) navigation logic.
 */
import { LeftSidebarAdapter } from './LeftSidebar';
import { ICONS } from '../ui/icons';
import { FolderManager } from '../models/FolderManager';

export class ChatGPTAdapter extends LeftSidebarAdapter {
    platformId = 'ChatGPT';
    // Target selector for ChatGPT's native popover action menu
    itemSelector = '[role="menu"] > div[role="group"]:last-child';

	constructor() {
        super();
        this.initClickListener();
    }

    initClickListener(): void {
        document.body.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
			// get chat info
			const historyContainer = target.closest('#history');	// chat container
            if (historyContainer) {
				// Traverse up the DOM tree to locate the list item, then find the anchor tag containing the chat ID
				const chatRow = target.closest('li');
				const linkEl = chatRow?.querySelector('a[href*="/c/"]') as HTMLAnchorElement;
				
				if (linkEl) {
					const href = linkEl.getAttribute('href') || '';
					const pathParts = href.split('/');
					const chatId = pathParts[pathParts.length - 1];
					const title = linkEl.textContent?.trim() || document.title;

					if (chatId) {
						this.currentTargetChat = { id: chatId, title };
					}
				}
			} else if (!target.closest('.aichat-cascade-menu, .aichat-folder-menu-item')) {

                // Invalidate the cache if the user clicks completely outside the sidebar or menus
                this.currentTargetChat = null;
            }

			// Defers execution slightly to allow the SPA to render the context menu DOM elements.
            setTimeout(() => {
                this.createMenuItem();
            }, 50);

        }, true); // Use capture phase to ensure data is grabbed before React swallows the event
    }

    private createMenuItem(): void {

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
			this.showLevelMenu(rect.right + 2, rect.top, folders);
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

	/**
	* Smooth navigation for ChatGPT SPA
	*/
	async smoothNavigate(chatId: string, fallbackUrl: string): Promise<void> {
		const targetUrl = this.resolveChatUrl(chatId);
		
		// 1. Attempt to find the native chat link in the left sidebar and trigger a click directly
        // This is the safest way to let the SPA's internal router handle the transition.
		const nativeLink = document.querySelector(`a[href*="/c/${chatId}"]`) as HTMLAnchorElement | null;
		if (nativeLink) {
			nativeLink.click();
			return;
		}

		// 2. Fallback: Use the History API for SPA routing navigation.
		window.history.pushState({}, '', targetUrl);
		
		// Dispatch a popstate event to notify the frontend framework (Next.js) that the route has changed.
		window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
	}
}