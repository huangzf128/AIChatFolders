// src/bridges/deepseek-main-bridge.ts
// Runs in the MAIN world (page's own JS context), same reasoning as the
// other *-main-bridge.ts files: only code running in the page's own
// world can observe the page's own fetch/XHR calls.
// ─── Native Conversation Deletion Interception ─────────────────────────
// Confirmed via network tab: DeepSeek deletes a conversation with
//   POST https://chat.deepseek.com/api/v0/chat_session/delete
//   body: { "chat_session_id": "<uuid>" }
//   -> 200 OK
// Unlike Claude/ChatGPT, the id is NOT in the URL — it's inside the
// JSON request body — so the body has to be read, not just the URL.
const DELETE_ENDPOINT_PATH = '/api/v0/chat_session/delete';

/** Broadcasts a native chat change (delete, rename, ...) to the isolated world (DeepSeekAdapter). */
function notifyConversationChanged(chatId: string, type: 'delete' | 'rename'): void {
  window.dispatchEvent(new CustomEvent('aichatfolders:conversation-changed', {
    detail: { chatId, type }
  }));
}

/** Extracts `chat_session_id` from the delete endpoint's JSON request body. */
function extractDeletedChatId(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody);
    return typeof parsed?.chat_session_id === 'string' ? parsed.chat_session_id : null;
  } catch (e) {
    console.warn('[AIChatFolders] Failed to parse DeepSeek delete request body.', e);
    return null;
  }
}

/** True if the given URL points at the chat session delete endpoint. */
function isDeleteRequestUrl(url: string): boolean {
  return url.includes(DELETE_ENDPOINT_PATH);
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
  if (method === 'POST' && isDeleteRequestUrl(url)) {
    if (typeof init?.body === 'string') {
      bodyText = init.body;
    } else if (input instanceof Request) {
      try {
        bodyText = await input.clone().text();
      } catch (e) {
        console.warn('[AIChatFolders] Failed to clone DeepSeek delete request body.', e);
      }
    }
  }
  const response = await originalFetch.call(this, input, init);
  // Only broadcast after a genuinely successful response, so a failed
  // delete (network error / 403 / etc.) never wipes local folder records.
  if (method === 'POST' && response.ok && bodyText) {
    const chatId = extractDeletedChatId(bodyText);
    if (chatId) notifyConversationChanged(chatId, 'delete');
  }
  return response;
};

// Belt-and-braces: also patch XMLHttpRequest in case the delete call
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
  if (method === 'POST' && url && isDeleteRequestUrl(url) && typeof body === 'string') {
    this.addEventListener('loadend', () => {
      if (this.status >= 200 && this.status < 300) {
        const chatId = extractDeletedChatId(body);
        if (chatId) notifyConversationChanged(chatId, 'delete');
      }
    });
  }
  return originalXhrSend.call(this, body as any);
};