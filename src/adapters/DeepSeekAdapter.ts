/**
 * @file DeepSeekAdapter.ts
 * @description Implementation for DeepSeek with native menu injection and SPA smooth navigation.
 */
import { LeftSidebarAdapter } from './LeftSidebar';
import { FolderManager } from '../models/FolderManager';
import { ICONS } from '../ui/icons';

export class DeepSeekAdapter extends LeftSidebarAdapter {
    platformId = 'DeepSeek';
    
    // Selector for DeepSeek's chat list container or action dropdown menu
    // Note: Update this selector based on DeepSeek's actual DOM structure for chat actions/menus
    itemSelector = '.ds-floating-position-wrapper .ds-dropdown-menu'; 

	constructor() {
        super();
        this.initClickListener();
    }

    initClickListener(): void {
        document.body.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
			// get chat info
			const historyContainer = target.closest('div.ds-scroll-area.ds-scroll-area--show-on-focus-within');	// chat container
            if (historyContainer) {
				// Search upwards to find the menu item / container, then locate the associated chat link containing /c/
				const chatRow = target;
				const linkEl = chatRow?.closest('a[href*="/a/chat/s/"]') as HTMLAnchorElement;
				
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
				
                // Clear cache ONLY IF the click is outside the sidebar history, custom menu, AND native menu
                this.currentTargetChat = null;
            }

			// Defer execution slightly to allow ChatGPT to render the context menu DOM into the document
            setTimeout(() => {
                this.createMenuItem();
            }, 50);

        }, true); // Use capture phase to ensure the ID is grabbed before the menu opens
    }

	private createMenuItem(): void {
        const menuContainer = document.querySelector(this.itemSelector);
        if (!menuContainer || menuContainer.querySelector('.aichat-folder-menu-item')) return;

        const button = document.createElement('div');
        button.className = 'aichat-folder-menu-item ds-dropdown-menu-option ds-dropdown-menu-option--none';
		button.setAttribute('role', 'menu');
        // button.style.cssText = 'cursor: pointer; display: flex; align-items: center; padding: 8px 12px;';
        button.innerHTML = `
			<div class="ds-dropdown-menu-option__icon">${ICONS.GPT_MENU_ADD_FOLDER}</div>
            <div class="ds-dropdown-menu-option__label">Add to Folder</div>
            <span style="font-size: 10px; opacity: 0.5; margin-left: 4px;">▶</span>
        `;
        
        menuContainer.appendChild(button);

        button.addEventListener('mouseenter', async () => {
            this.clearCloseTimer();
            const rect = button.getBoundingClientRect();
            const folders = await FolderManager.getFolders();
            this.showLevelMenu(rect.right + 2, rect.top, folders);
        });

        button.addEventListener('mouseleave', () => this.startCloseTimer());	
	}

    /**
     * Extracts chat telemetry metadata from the active DeepSeek session.
     */
    getChatInfo(): { id: string; title: string; url: string } {

		if (this.currentTargetChat) {
            return {
                id: this.currentTargetChat.id,
                title: this.currentTargetChat.title,
                url: this.resolveChatUrl(this.currentTargetChat.id)
            };
        }

        // DeepSeek typically uses a unique chat ID path segment (e.g., /chat/[id] or similar)
        const pathParts = window.location.pathname.split('/');
        const chatId = pathParts[pathParts.length - 1] || '';
        
        const titleText = document.title;
        return {
            id: chatId || Date.now().toString(),
            title: titleText.trim(),
            url: window.location.href
        };
    }

    /**
     * Resolves raw chat identifiers into complete DeepSeek navigable URLs.
     */
    resolveChatUrl(chatId: string): string {
        return `https://chat.deepseek.com/a/chat/s/${chatId}`;
    }

    /**
     * Smooth navigation for DeepSeek SPA.
     */
    async smoothNavigate(chatId: string, fallbackUrl: string): Promise<void> {
        const targetUrl = this.resolveChatUrl(chatId);
        
        // 1. Attempt to find the native chat link in the sidebar and trigger a click directly
        const nativeLink = document.querySelector(`a[href*="/chat/${chatId}"]`) as HTMLAnchorElement | null;
        if (nativeLink) {
            nativeLink.click();
            return;
        }

        // 2. Fallback to History API for SPA routing navigation if the element isn't in the DOM
        window.history.pushState({}, '', targetUrl);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }
}