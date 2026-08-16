/**
 * @file DeepSeekAdapter.ts
 * @description Implementation for DeepSeek with native menu injection and SPA smooth navigation.
 */
import { LeftSidebarAdapter } from './LeftSidebar';
import { FolderManager } from '../models/FolderManager';
import { ICONS } from '../ui/icons';

export class DeepSeekAdapter extends LeftSidebarAdapter {
    platformId = 'deepseek';
    // Selector for DeepSeek's chat list container or action dropdown menu
    itemSelector = '.ds-floating-position-wrapper .ds-dropdown-menu'; 
	protected override historySelector = 'div.ds-scroll-area.ds-scroll-area--show-on-focus-within';
	protected override scrollContainerSelector = this.historySelector;
	protected override rowSelector = 'a[href*="/a/chat/s/"]';
	protected override linkSelector = 'a[href*="/a/chat/s/"]';

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
            this.showLevelMenu({ left: rect.left, right: rect.right, top: rect.top }, folders);
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
	 * `historySelector` matches both an outer wrapper and, nested inside it,
	 * an inner element sharing the same classes — only that inner element is
	 * actually scrollable, so it's looked up relative to `container`.
	 * @protected
	 * @override
	 */
	protected override resolveScrollContainer(container: HTMLElement | null): HTMLElement | null {
		return (container?.querySelector(this.historySelector) as HTMLElement | null) ?? null;
	}

	/**
	 * Reads the DeepSeek session token from localStorage.
	 * Format: localStorage['userToken'] = '{"value":"<token>","__version":"0"}'
	 * @private
	 * @returns {string | null} The raw token string, or null if not found / malformed.
	 */
	private findAuthToken(): string | null {
		const raw = localStorage.getItem('userToken');
		if (!raw) return null;

		try {
			const parsed = JSON.parse(raw);
			return parsed?.value ?? null;
		} catch (e) {
			console.warn('[AIChatFolders] Failed to parse DeepSeek userToken from localStorage.', e);
			return null;
		}
	}

	/**
	 * Polls localStorage for the auth token until it appears or the timeout is reached.
	 * This is necessary because content scripts can execute before the page's own
	 * login/init JS has finished writing the token into localStorage — especially
	 * right after a fresh login, where there's no DOM event we can hook into
	 * (localStorage writes within the same tab don't fire the `storage` event).
	 * @private
	 * @param {number} timeoutMs - Maximum total time to wait, in milliseconds.
	 * @param {number} intervalMs - Delay between each retry attempt, in milliseconds.
	 * @returns {Promise<string | null>} The resolved token, or null if it never appeared in time.
	 */
	private async waitForAuthToken(timeoutMs = 8000, intervalMs = 300): Promise<string | null> {
		const deadline = Date.now() + timeoutMs;

		while (Date.now() < deadline) {
			const token = this.findAuthToken();
			if (token) return token;
			await new Promise(resolve => setTimeout(resolve, intervalMs));
		}

		// One final check right at the deadline, just in case
		return this.findAuthToken();
	}

	/**
	 * Fetches the currently logged-in DeepSeek user's unique account ID.
	 * Requires both the session cookie AND the Bearer token from localStorage.
	 * @returns {Promise<string | null>}
	 */
	async getAccountKey(): Promise<string | null> {
		if (this.accountKey) return this.accountKey;

		// Wait (with polling) instead of failing immediately — the page's own
		// login/init script may not have written the token yet at this point.
		const token = await this.waitForAuthToken();
		if (!token) {
			console.warn('[AIChatFolders] DeepSeek auth token not found after waiting.');
			return null;
		}

		try {
			const resp = await fetch('https://chat.deepseek.com/api/v0/users/current', {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (!resp.ok) return null;

			const json = await resp.json();
			if (json.code === 0 && json.data?.biz_code === 0) {
				const userId: string | undefined = json.data?.biz_data?.id;
				if (userId) {
					this.accountKey = userId;
					return userId;
				}
			}
			return null;
		} catch (e) {
			console.warn('[AIChatFolders] Failed to fetch DeepSeek user info.', e);
			return null;
		}
	}

}