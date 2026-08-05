// src/bridges/chatgpt-main-bridge.ts
// Runs in the MAIN world (page's own JS context), same reasoning as
// claude-main-bridge.ts and gemini-main-bridge.ts: only code running in
// the page's own world can observe the page's own fetch/XHR calls.

// ─── Native Conversation Deletion & Rename Interception ─────────────────────
// Confirmed via network tab:
//   DELETE https://chatgpt.com/backend-api/conversation/id/{uuid}
//     -> 200 OK { "success": true }
//   POST   https://chatgpt.com/backend-api/conversation/id/{uuid}/rename
//     body: { "title": "New Title" }
//     -> 200 OK
// Both share the same {uuid} path segment, so a single id pattern covers
// them — it just needs to tolerate an optional trailing "/rename".
const CONVERSATION_ID_PATTERN = /\/backend-api\/conversation\/id\/([0-9a-fA-F-]{36})(?:[/?]|$)/;
const RENAME_URL_SUFFIX = '/rename';

/** Broadcasts a native chat change (delete, rename, ...) to the isolated world (ChatGPTAdapter). */
function notifyConversationChanged(chatId: string, type: 'delete' | 'rename', extra?: { newTitle?: string },): void {
  	window.dispatchEvent(new CustomEvent('aichatfolders:conversation-changed', { detail: { chatId, type, ...extra } }));
}

/** Resolves the request URL regardless of whether `fetch` was called with a string or a `Request`. */
function resolveRequestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof Request) return input.url;
	return input.toString();
}

/** Extracts the new title from a rename request's raw JSON body text. */
function extractNewTitle(rawBody: string): string | undefined {
	try {
		const parsed = JSON.parse(rawBody);
		return typeof parsed?.title === 'string' ? parsed.title : undefined;
	} catch {
		return undefined;
	}
}

const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
	const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
	const url = resolveRequestUrl(input);

	// The request body must be captured BEFORE calling the original fetch,
	// since a `Request` object's body stream can only be read once — the
	// page's own code will consume it when the real fetch runs. ChatGPT's
	// rename call may pass its body on the Request object itself rather
	// than via `init.body`, so both sources are checked.
	let bodyText: string | null = null;
	if (method === 'POST' && url.includes(RENAME_URL_SUFFIX)) {
		if (typeof init?.body === 'string') {
			bodyText = init.body;
		} else if (input instanceof Request) {
			try {
				bodyText = await input.clone().text();
			} catch (e) {
				console.warn('[AIChatFolders] Failed to clone ChatGPT rename request body.', e);
			}
		}
	}

	const response = await originalFetch.call(this, input, init);
	// Only broadcast after a genuinely successful response, so a failed
	// delete/rename (network error / 403 / etc.) never touches local folder records.
	if (response.ok) {
		const match = url.match(CONVERSATION_ID_PATTERN);
		if (match) {
			if (method === 'DELETE') {
				notifyConversationChanged(match[1]!, 'delete');
			} else if (method === 'POST' && bodyText) {
				const newTitle = extractNewTitle(bodyText);
				if (newTitle) notifyConversationChanged(match[1]!, 'rename', { newTitle });
			}
		}
	}
	return response;
};

// Belt-and-braces: also patch XMLHttpRequest in case either path
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
		const match = url.match(CONVERSATION_ID_PATTERN);
		if (!match) return;
		if (method === 'DELETE') {
			notifyConversationChanged(match[1]!, 'delete');
		} else if (method === 'POST' && url.includes(RENAME_URL_SUFFIX)) {
			const newTitle = extractNewTitle((this as any).__aichatfolders_body);
			if (newTitle) notifyConversationChanged(match[1]!, 'rename', { newTitle });
		}
	});
	return originalXhrSend.apply(this, args as any);
};