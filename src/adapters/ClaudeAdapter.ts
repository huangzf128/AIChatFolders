/**
 * @file ClaudeAdapter.ts
 * @description Implementation for Anthropic Claude with native menu injection and SPA smooth navigation.
 */
import { LeftSidebarAdapter } from './LeftSidebar';
import { FolderManager } from '../models/FolderManager';
import { ICONS } from '../ui/icons';

/**
 * Ordered list of localStorage keys that may hold the account UUID.
 * These are undocumented internal keys used by Claude's frontend,
 * so we check multiple candidates and fall back gracefully if any are removed/renamed.
 */
const ACCOUNT_UUID_STORAGE_KEYS = [
	'__qk_hint_account_uuid',
	'rq-cache-confirmed-account',
];

/** Matches a UUID string, optionally wrapped in JSON quotes (e.g. "\"xxxx-xxxx\""). */
const UUID_PATTERN = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export class ClaudeAdapter extends LeftSidebarAdapter {
    platformId = 'claude';
    
    // Selector for Claude's action menu container (adjust selector based on actual DOM inspection)
    itemSelector = '[role="menu"] div:first-child';

	constructor() {
        super();
    }

	/**
	 * Invoked only after user authentication is confirmed in content.ts
	 */
	public init(): void {
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

	async getAccountKey(): Promise<string | null> {
		if (this.accountKey) {
			return this.accountKey;
		}
		this.accountKey = this.tryReadAccountUuidFromStorage() ?? await this.waitForAccountUuid();
		return this.accountKey;
	}

	/**
	 * Strategy 1 (preferred): read the account UUID directly from localStorage.
	 * This is cheap and avoids touching React internals.
	 */
	private tryReadAccountUuidFromStorage(): string | null {
		for (const key of ACCOUNT_UUID_STORAGE_KEYS) {
			try {
				const raw = localStorage.getItem(key);
				if (!raw) continue;
				const match = raw.match(UUID_PATTERN);
				if (match) {
					return match[0];
				}
			} catch (e) {
				console.warn(`[AIChatFolders] Failed to read localStorage key "${key}".`, e);
			}
		}
		return null;
	}

	/**
	 * Dispatches a request to the MAIN world bridge script and listens for a single response containing the account UUID.
	 * 
	 * @returns A Promise that resolves to the account UUID string if retrieved, or null.
	 */
	private requestAccountUuidFromMainWorld(): Promise<string | null> {
		// One-time event handler to catch the bridge's response
		return new Promise((resolve) => {
			const handler = (e: Event) => {
				// Immediately clean up the listener to prevent memory leaks and duplicate handling
				window.removeEventListener('aichatfolders:account-uuid-result', handler);
				resolve((e as CustomEvent).detail ?? null);
			};
			// Listen for the result event from the MAIN world
			window.addEventListener('aichatfolders:account-uuid-result', handler);
			// Trigger the MAIN world script to execute `tryReadAccountUuid()`
			window.dispatchEvent(new CustomEvent('aichatfolders:request-account-uuid'));
		});
	}

	/**
	 * Resolves the account UUID from the MAIN world bridge in an event-driven way,
	 * instead of blindly polling on a fixed interval/timeout.
	 *
	 * How it works:
	 * 1. Ask once immediately via the "pull" channel.
	 * 2. Keep listening for the "push" event — the bridge's MutationObserver will
	 *    broadcast the uuid the instant `user-menu-button` appears in the DOM,
	 *    no matter how long login/hydration actually takes.
	 * 3. Re-ask whenever the tab becomes visible again. Background tabs get their
	 *    timers throttled by the browser, so relying on setInterval/setTimeout
	 *    alone can silently miss the window during which login finished.
	 * 4. `timeoutMs` is only a safety net for genuinely logged-out sessions —
	 *    it is no longer the primary mechanism, so its exact value is not critical.
	 *
	 * @param timeoutMs - Fallback timeout in milliseconds before giving up entirely (default: 60000ms).
	 * @returns A Promise resolving to the account UUID, or null if the fallback timeout is reached.
	 */
	private async waitForAccountUuid(timeoutMs = 60000): Promise<string | null> {
		return new Promise((resolve) => {
			let settled = false;

			// Cleans up all listeners/timers and resolves exactly once.
			const finish = (uuid: string | null) => {
				if (settled) return;
				settled = true;
				window.removeEventListener('aichatfolders:account-uuid-result', onResult);
				document.removeEventListener('visibilitychange', onVisibilityChange);
				clearTimeout(timer);
				resolve(uuid);
			};

			// Handles both the immediate "pull" response and any later "push" broadcast.
			const onResult = (e: Event) => {
				const uuid = (e as CustomEvent).detail ?? null;
				// A null result just means "not found yet" — keep waiting for a later push,
				// don't give up early.
				if (uuid) finish(uuid);
			};
			window.addEventListener('aichatfolders:account-uuid-result', onResult);

			// Ask once right away in case the uuid is already available.
			window.dispatchEvent(new CustomEvent('aichatfolders:request-account-uuid'));

			// Re-ask when the tab regains focus, to counter background-tab timer throttling.
			const onVisibilityChange = () => {
				if (document.visibilityState === 'visible') {
					window.dispatchEvent(new CustomEvent('aichatfolders:request-account-uuid'));
				}
			};
			document.addEventListener('visibilitychange', onVisibilityChange);

			// Fallback: stop waiting after timeoutMs in case the user is truly not logged in.
			const timer = setTimeout(() => finish(null), timeoutMs);
		});
	}
}