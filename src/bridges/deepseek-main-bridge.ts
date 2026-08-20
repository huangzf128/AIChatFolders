// Runs in the MAIN world (page's own JS context), same reasoning as the
// other *-main-bridge.ts files: only code running in the page's own
// world can observe the page's own fetch/XHR calls.

// ─── Native Conversation Deletion & Rename Interception ─────────────────────
// Confirmed via network tab:
//   POST https://chat.deepseek.com/api/v0/chat_session/delete
//     body: { "chat_session_ids": ["<uuid>", ...] }
//     -> 200 OK
//   POST https://chat.deepseek.com/api/v0/chat_session/update_title
//     body: { "chat_session_id": "<uuid>", "title": "<newTitle>" }
//     -> 200 OK
// Unlike Claude/ChatGPT, the id is NOT in the URL — it's inside the
// JSON request body for both endpoints — so the body has to be read,
// not just the URL.
// NOTE: DeepSeek's delete endpoint used to take a single `chat_session_id`
// string; it now batches ids into a `chat_session_ids` array (confirmed via
// network tab), which also covers multi-select delete from the native UI.
const DELETE_ENDPOINT_PATH = '/api/v0/chat_session/delete';
const UPDATE_TITLE_ENDPOINT_PATH = '/api/v0/chat_session/update_title';

/** Broadcasts a native chat change (delete, rename, ...) to the isolated world (DeepSeekAdapter). */
function notifyConversationChanged(chatId: string, type: 'delete' | 'rename', extra?: { newTitle?: string },): void {
  	window.dispatchEvent(new CustomEvent('aichatfolders:conversation-changed', { detail: { chatId, type, ...extra } }));
}

/**
 * Extracts every deleted chat id from the delete endpoint's JSON request
 * body. Primarily reads the current `chat_session_ids` array (batch
 * delete), with a fallback to the legacy single `chat_session_id` string
 * field in case DeepSeek's client ever reverts or mixes both shapes.
 */
function extractDeletedChatIds(rawBody: string): string[] | null {
	try {
		const parsed = JSON.parse(rawBody);
		if (Array.isArray(parsed?.chat_session_ids)) {
			const ids = parsed.chat_session_ids.filter((id: unknown): id is string => typeof id === 'string');
			return ids.length > 0 ? ids : null;
		}
		// Legacy shape fallback: a single chat id as a plain string field.
		return typeof parsed?.chat_session_id === 'string' ? [parsed.chat_session_id] : null;
	} catch (e) {
		console.warn('[AIChatFolders] Failed to parse DeepSeek delete request body.', e);
		return null;
	}
}

/** Extracts {chatId, newTitle} from the update_title endpoint's JSON request body. */
function extractRenamedChat(rawBody: string): { chatId: string; newTitle: string } | null {
	try {
		const parsed = JSON.parse(rawBody);
		if (typeof parsed?.chat_session_id === 'string' && typeof parsed?.title === 'string') {
		return { chatId: parsed.chat_session_id, newTitle: parsed.title };
		}
	} catch (e) {
		console.warn('[AIChatFolders] Failed to parse DeepSeek update_title request body.', e);
	}
	return null;
}

/** True if the given URL points at the chat session delete endpoint. */
function isDeleteRequestUrl(url: string): boolean {
  	return url.includes(DELETE_ENDPOINT_PATH);
}

/** True if the given URL points at the chat session rename endpoint. */
function isRenameRequestUrl(url: string): boolean {
  	return url.includes(UPDATE_TITLE_ENDPOINT_PATH);
}

/** Resolves the request URL regardless of whether `fetch` was called with a string or a `Request`. */
function resolveRequestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof Request) return input.url;
	return input.toString();
}

// DeepSeek's own frontend issues its API calls via `fetch` (confirmed by
// the Bearer-token pattern already used elsewhere in this codebase), so
// `fetch` is the primary interception path here, with XHR patched too
// as belt-and-braces — same approach as claude-main-bridge.ts.
const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
	const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
	const url = resolveRequestUrl(input);
	// The request body must be captured BEFORE calling the original fetch,
	// since a `Request` object's body stream can only be read once — the
	// page's own code will consume it when the real fetch runs.
	let bodyText: string | null = null;
	if (method === 'POST' && (isDeleteRequestUrl(url) || isRenameRequestUrl(url))) {
		if (typeof init?.body === 'string') {
		bodyText = init.body;
		} else if (input instanceof Request) {
			try {
				bodyText = await input.clone().text();
			} catch (e) {
				console.warn('[AIChatFolders] Failed to clone DeepSeek request body.', e);
			}
		}
	}
	const response = await originalFetch.call(this, input, init);
	// Only broadcast after a genuinely successful response, so a failed
	// delete/rename (network error / 403 / etc.) never touches local folder records.
	if (method === 'POST' && response.ok && bodyText) {
		if (isDeleteRequestUrl(url)) {
		// Batch delete: broadcast one 'delete' event per id, so every
		// matching local folder entry gets cleaned up, not just the first.
		const chatIds = extractDeletedChatIds(bodyText);
		chatIds?.forEach(chatId => notifyConversationChanged(chatId, 'delete'));
		} else if (isRenameRequestUrl(url)) {
		const renamed = extractRenamedChat(bodyText);
		if (renamed) notifyConversationChanged(renamed.chatId, 'rename', { newTitle: renamed.newTitle });
		}
	}
	return response;
};

// Belt-and-braces: also patch XMLHttpRequest in case either call
// (present or future) ever goes through XHR instead of fetch.
const originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
  (this as any).__aichatfolders_method = method?.toUpperCase();
  (this as any).__aichatfolders_url = typeof url === 'string' ? url : url.toString();
  return originalXhrOpen.apply(this, [method, url, ...rest] as any);
};
const originalXhrSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
	const method = (this as any).__aichatfolders_method;
	const url = (this as any).__aichatfolders_url as string | undefined;
	if (method === 'POST' && url && typeof body === 'string') {
		if (isDeleteRequestUrl(url)) {
		this.addEventListener('loadend', () => {
			if (this.status >= 200 && this.status < 300) {
			// Batch delete: broadcast one 'delete' event per id.
			const chatIds = extractDeletedChatIds(body);
			chatIds?.forEach(chatId => notifyConversationChanged(chatId, 'delete'));
			}
		});
		} else if (isRenameRequestUrl(url)) {
		this.addEventListener('loadend', () => {
			if (this.status >= 200 && this.status < 300) {
			const renamed = extractRenamedChat(body);
			if (renamed) notifyConversationChanged(renamed.chatId, 'rename', { newTitle: renamed.newTitle });
			}
		});
		}
	}
	return originalXhrSend.call(this, body as any);
};