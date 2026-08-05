// src/bridges/claude-main-bridge.ts
// Runs in the MAIN world (page's own JS context), since content scripts
// in the isolated world cannot see React's internal expando properties
// (e.g. `__reactFiber$...`) attached to DOM nodes by the page's own script.

// ─── Retrieve Account ─────────────────────────
/**
 * Retrieves the internal React Fiber instance attached to a given DOM node.
 */
function getReactFiber(dom: Element): any {
	const key = Object.keys(dom).find(
		(k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
	);
	return key ? (dom as any)[key] : null;
}

/**
 * Recursively searches an object tree for account data containing `uuid`.
 * Limits recursion depth to prevent stack overflow.
 */
function searchObjectForAccount(obj: any, depth = 0): any {
	if (!obj || typeof obj !== 'object' || depth > 3) return null;
	if ('uuid' in obj && 'email_address' in obj) return obj;
	if (obj.account && typeof obj.account === 'object') return obj.account;
	for (const key of Object.keys(obj)) {
		try {
			const val = obj[key];
			if (val && typeof val === 'object') {
				const found = searchObjectForAccount(val, depth + 1);
				if (found) return found;
			}
		} catch { }
	}
	return null;
}

/**
 * Traverses upwards through the React Fiber tree, inspecting `memoizedProps` 
 * and linked `memoizedState` hooks at each level to locate user account data.
 */
function findAccountFromFiber(fiber: any, maxDepth = 60): any {
	let node = fiber;
	let depth = 0;
	while (node && depth < maxDepth) {
		if (node.memoizedProps) {
			const found = searchObjectForAccount(node.memoizedProps);
			if (found) return found;
		}
		let hook = node.memoizedState;
		let guard = 0;
		while (hook && guard < 30) {
			const found = searchObjectForAccount(hook.memoizedState);
			if (found) return found;
			hook = hook.next;
			guard++;
		}
		node = node.return;
		depth++;
	}
	return null;
}

/**
 * Attempts to read the logged-in user's account UUID from the DOM's React Fiber context.
 */
function tryReadAccountUuid(): string | null {
	const anchorEl = document.querySelector('[data-testid="user-menu-button"]');
	if (!anchorEl) return null;
	const fiber = getReactFiber(anchorEl);
	if (!fiber) return null;
	return findAccountFromFiber(fiber)?.uuid ?? null;
}

/**
 * Listens for requests from the Isolated World (ClaudeAdapter) 
 * and dispatches the account UUID result back.
 */
window.addEventListener('aichatfolders:request-account-uuid', () => {
	window.dispatchEvent(new CustomEvent('aichatfolders:account-uuid-result', {
		detail: tryReadAccountUuid()
	}));
});


/**
 * Caches the last known uuid so a late "pull" request from the isolated world
 * can be answered immediately even if the DOM has changed since it was found.
 */
let cachedUuid: string | null = null;

/**
 * Broadcasts the account UUID to the isolated world (ClaudeAdapter).
 */
function pushAccountUuid(uuid: string): void {
	cachedUuid = uuid;
	window.dispatchEvent(new CustomEvent('aichatfolders:account-uuid-result', {
		detail: uuid
	}));
}

/**
 * "Pull" channel: responds on demand whenever the isolated world explicitly asks.
 * Kept for the initial synchronous attempt and for the visibilitychange re-ask.
 */
window.addEventListener('aichatfolders:request-account-uuid', () => {
	const uuid = tryReadAccountUuid() ?? cachedUuid;
	window.dispatchEvent(new CustomEvent('aichatfolders:account-uuid-result', {
		detail: uuid
	}));
});

/**
 * "Push" channel: proactively watches the DOM and reports the uuid the moment
 * `user-menu-button` is rendered, instead of making the isolated world guess
 * a polling interval/timeout. This is what actually fixes the "works only
 * after a manual refresh" issue — no matter how long login/hydration takes,
 * this observer fires exactly when the element becomes available.
 */
new MutationObserver(() => {
	const uuid = tryReadAccountUuid();
	if (uuid && uuid !== cachedUuid) {
		pushAccountUuid(uuid);
	}
}).observe(document.documentElement, { childList: true, subtree: true });


// ─── Native Conversation Deletion Interception ─────────────────────────
// Claude gives no reliable DOM signal for delete (row just disappears)
// or rename, so we intercept both at the network layer instead — here
// in the MAIN world, since this is where Claude's own React app actually
// issues the request.
const CHAT_CONVERSATION_ID_PATTERN =
  /\/chat_conversations\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:[/?]|$)/;

/** Broadcasts a native chat change (delete, rename, ...) to the isolated world (ClaudeAdapter). */
function notifyConversationChanged(chatId: string, type: 'delete' | 'rename', extra?: { newTitle?: string }): void {
	window.dispatchEvent(new CustomEvent('aichatfolders:conversation-changed', {
		detail: { chatId, type, ...extra }
	}));
}

/** Resolves the request URL regardless of whether `fetch` was called with a string or a `Request`. */
function resolveRequestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof Request) return input.url;
	return input.toString();
}

/**
 * Extracts the new title from a PUT request body, if present.
 * Claude's rename request body looks like: { "name": "New Title" }.
 */
function extractNewTitle(body: BodyInit | null | undefined): string | undefined {
	if (typeof body !== 'string') return undefined;
	try {
		const parsed = JSON.parse(body);
		return typeof parsed?.name === 'string' ? parsed.name : undefined;
	} catch {
		return undefined;
	}
}

const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
	const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
	const url = resolveRequestUrl(input);
	const response = await originalFetch.call(this, input, init);
	// Only broadcast after a genuinely successful response (202 Accepted counts as ok),
	// so a failed delete/rename (network error/403/etc.) never touches local folder records.
	if (response.ok) {
		const match = url.match(CHAT_CONVERSATION_ID_PATTERN);
		if (match) {
			if (method === 'DELETE') {
				notifyConversationChanged(match[1]!, 'delete');
			} else if (method === 'PUT') {
				const newTitle = extractNewTitle(init?.body);
				if (newTitle) notifyConversationChanged(match[1]!, 'rename', { newTitle });
			}
		}
	}
	return response;
};

// Belt-and-braces: also patch XMLHttpRequest in case a deletion path
// (present or future) ever goes through XHR instead of fetch.
const originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
  (this as any).__aichatfolders_method = method?.toUpperCase();
  (this as any).__aichatfolders_url = typeof url === 'string' ? url : url.toString();
  return originalXhrOpen.apply(this, [method, url, ...rest] as any);
};

const originalXhrSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (...args: any[]) {
	(this as any).__aichatfolders_body = args[0];
	this.addEventListener('loadend', () => {
		const method = (this as any).__aichatfolders_method;
		const url = (this as any).__aichatfolders_url as string | undefined;
		if (!url || this.status < 200 || this.status >= 300) return;
		const match = url.match(CHAT_CONVERSATION_ID_PATTERN);
		if (!match) return;
		if (method === 'DELETE') {
			notifyConversationChanged(match[1]!, 'delete');
		} else if (method === 'PUT') {
			const newTitle = extractNewTitle((this as any).__aichatfolders_body);
			if (newTitle) notifyConversationChanged(match[1]!, 'rename', { newTitle });
		}
	});
	return originalXhrSend.apply(this, args as any);
};
