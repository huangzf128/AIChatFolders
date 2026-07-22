/**
 * @file GeminiAdapter.ts
 * @description Implementation for Google Gemini with native menu injection.
 */
import { LeftSidebarAdapter } from './LeftSidebar';
import { FolderManager } from '../models/FolderManager';

export class GeminiAdapter extends LeftSidebarAdapter {
    platformId = 'Gemini';
    // Gemini's menu content container selector
    itemSelector = 'div.mat-mdc-menu-content';

	constructor() {
        super();
        this.initClickListener();
    }

    initClickListener(): void {
        document.body.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
			// get chat info
			const historyContainer = target.closest('#sidenav-section-content-chats');	// chat container
            if (historyContainer) {
				// Search upwards to find the menu item / container, then locate the associated chat link containing /c/
				const chatRow = target.closest('gem-nav-list-item');
				const linkEl = chatRow?.querySelector('a[href*="/app/"]') as HTMLAnchorElement;
				
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

        const button = document.createElement('button');
        button.className = 'mat-mdc-menu-item mat-focus-indicator aichat-folder-menu-item';
        button.innerHTML = `
            <mat-icon class="mat-icon google-symbols">folder_open</mat-icon>
            <span class="mat-mdc-menu-item-text" style="flex:1">Add to Folder</span>
            <span style="font-size: 10px; opacity: 0.5;">▶</span>
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

	getChatInfo() {

		if (this.currentTargetChat) {
            return {
                id: this.currentTargetChat.id,
                title: this.currentTargetChat.title,
                url: this.resolveChatUrl(this.currentTargetChat.id)
            };
        }

		// 💡 Locate the anchor element using your precise discovered selectors
		const activeLinkEl = document.querySelector('gem-nav-list-item.always-show-hovered-trailing-content');
		
		const anchorEl = activeLinkEl?.querySelector('a');
		const chatId = anchorEl?.getAttribute('href')?.split('/').pop() || 
                   window.location.pathname.split('/').pop() || '';

		const title = activeLinkEl?.querySelector('.title-text')?.textContent?.trim() || 
                  document.title;
		
		return { id: chatId, title: title, url: window.location.href };
	}

    /**
     * Resolves raw identifier strings back into functional navigation paths.
     */
    resolveChatUrl(chatId: string): string {
        return `https://gemini.google.com/app/${chatId}`;
    }

	/**
	 * Smooth navigation for Gemini SPA
	 */
	async smoothNavigate(chatId: string, fallbackUrl: string): Promise<void> {
		const SELECTOR = `div.chat-history a[href*="${chatId}"]`;
		const container = document.querySelector('infinite-scroller');
		
		const tryClick = (): boolean => {
			const nativeLink = document.querySelector(SELECTOR) as HTMLAnchorElement | null;
			if (nativeLink) {
				nativeLink.click();
				return true;
			}
			return false;
		};

		if (tryClick()) return;

		if (container) {
			for (let i = 0; i < 10; i++) {
				container.scrollTop = container.scrollHeight;
				await new Promise(r => setTimeout(r, 450));
				if (tryClick()) return;
			}
		}

		window.location.href = fallbackUrl;
	}	
}