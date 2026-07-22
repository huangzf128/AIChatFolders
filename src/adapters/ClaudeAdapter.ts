/**
 * @file ClaudeAdapter.ts
 * @description Implementation for Anthropic Claude with native menu injection and SPA smooth navigation.
 */
import { LeftSidebarAdapter } from './LeftSidebar';
import { FolderManager } from '../models/FolderManager';
import { ICONS } from '../ui/icons';

export class ClaudeAdapter extends LeftSidebarAdapter {
    platformId = 'Claude';
    
    // Selector for Claude's action menu container (adjust selector based on actual DOM inspection)
    itemSelector = '[role="menu"] div:first-child';

	constructor() {
        super();
        this.initClickListener();
    }

    initClickListener(): void {
        document.body.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
			// get chat info
			const historyContainer = target.closest('ul.flex.flex-col');	// chat container
            if (historyContainer) {
				// Search upwards to find the menu item / container, then locate the associated chat link containing /c/
				const chatRow = target.closest('li');
				const linkEl = chatRow?.querySelector('a[href*="/chat/"]') as HTMLAnchorElement;
				
				if (linkEl) {
					const href = linkEl.getAttribute('href') || '';
					const pathParts = href.split('/');
					const chatId = pathParts[pathParts.length - 1];
					const title = this.getCleanTitle(linkEl);

					if (chatId) {
						this.currentTargetChat = { id: chatId, title };
					}
				}
			} else if (!target.closest('.aichat-cascade-menu, .aichat-folder-menu-item, [role="alertdialog"]')) {
				
                // Clear cache ONLY IF the click is outside the sidebar history, custom menu, AND native menu
                this.currentTargetChat = null;
			}

			// Defer execution slightly to allow ChatGPT to render the context menu DOM into the document
            setTimeout(() => {
                this.createMenuItem();
            }, 0);

        }, true); // Use capture phase to ensure the ID is grabbed before the menu opens
    }

	/**
	 * Extracts the first valid text content inside the element.
	 */
	private getCleanTitle(linkEl: HTMLElement): string {
		// Prefer targeting the main title container (works for most AI sidebars)
		const innerSpan = linkEl.querySelector('span.block.truncate');
		if (innerSpan && innerSpan.textContent) {
			return innerSpan.textContent.trim();
		}

		// Fallback strategy
		return linkEl.textContent?.trim() || document.title;
	}

	private createMenuItem(): void {
        const menuContainer = document.querySelector(this.itemSelector);
        if (!menuContainer || menuContainer.querySelector('.aichat-folder-menu-item')) return;

        const button = document.createElement('div');
        button.className = 'aichat-folder-menu-item cds-reset flex w-full items-center gap-xs compact:px-2 comfortable:px-2.5 py-[calc((var(--cds-h-control)-var(--cds-leading-body))/2)] rounded text-body select-none outline-none data-[disabled]:opacity-50 data-[disabled]:pointer-events-none text-primary data-[highlighted]:bg-fill-ghost-hover justify-between data-[popup-open]:bg-fill-ghost-hover';
		button.setAttribute('role', 'menuitem');
        button.innerHTML = `
			<span class="flex size-icon shrink-0 items-center justify-center">${ICONS.GPT_MENU_ADD_FOLDER}</span>
            <span class="min-w-0 flex-1 truncate">Add to Folder</span>
            <span class="-mr-1 shrink-0 text-muted">▶</span>
        `;
        
        menuContainer.appendChild(button);

        button.addEventListener('mouseenter', async () => {
			button.setAttribute('data-highlighted', '');

            this.clearCloseTimer();
            const rect = button.getBoundingClientRect();
            const folders = await FolderManager.getFolders();
            this.showLevelMenu(rect.right + 2, rect.top, folders);
        });

        button.addEventListener('mouseleave', () => {
			button.removeAttribute('data-highlighted');
			this.startCloseTimer()
		});
	}

    /**
     * Extracts chat telemetry metadata from the active Claude session.
     */
    getChatInfo(): { id: string; title: string; url: string } {

		if (this.currentTargetChat) {
            return {
                id: this.currentTargetChat.id,
                title: this.currentTargetChat.title,
                url: this.resolveChatUrl(this.currentTargetChat.id)
            };
        }

        // Claude typically encodes conversation IDs in the URL: /chat/[uuid]
        const pathParts = window.location.pathname.split('/');
        const chatId = pathParts[pathParts.indexOf('chat') + 1] || pathParts[pathParts.length - 1] || '';
        
        const titleText = document.title;
        return {
            id: chatId || Date.now().toString(),
            title: titleText.trim(),
            url: window.location.href
        };
    }

    /**
     * Resolves raw chat identifiers into complete Claude navigable URLs.
     */
    resolveChatUrl(chatId: string): string {
        return `https://claude.ai/chat/${chatId}`;
    }

    /**
     * Smooth navigation for Claude SPA.
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