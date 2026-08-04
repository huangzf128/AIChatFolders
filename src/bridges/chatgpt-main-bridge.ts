// src/bridges/chatgpt-main-bridge.ts
// Runs in the MAIN world (page's own JS context), same reasoning as
// claude-main-bridge.ts and gemini-main-bridge.ts: only code running in
// the page's own world can observe the page's own fetch/XHR calls.
// ─── Native Conversation Deletion Interception ─────────────────────────
// Confirmed via network tab: ChatGPT deletes a conversation with
//   DELETE https://chatgpt.com/backend-api/conversation/id/{uuid}
//   -> 200 OK { "success": true }
// The trailing {uuid} segment is the same conversation id used in the
// sidebar's own links (/c/{uuid}), so no extra lookup/translation step
// is required before broadcasting it onward.
const CONVERSATION_ID_PATTERN =
  /\/backend-api\/conversation\/id\/([0-9a-fA-F-]{36})(?:[/?]|$)/;

/** Broadcasts a native chat change (delete, rename, ...) to the isolated world (ChatGPTAdapter). */
function notifyConversationChanged(chatId: string, type: 'delete' | 'rename'): void {
  window.dispatchEvent(new CustomEvent('aichatfolders:conversation-changed', {
    detail: { chatId, type }
  }));
}

/** Resolves the request URL regardless of whether `fetch` was called with a string or a `Request`. */
function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof Request) return input.url;
  return input.toString();
}

// ChatGPT's own frontend (Next.js) issues this DELETE via `fetch`, so
// that is the primary interception path here — mirroring the same
// "patch fetch, patch XHR too as belt-and-braces" approach used in
// claude-main-bridge.ts.
const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const url = resolveRequestUrl(input);
  const response = await originalFetch.call(this, input, init);
  // Only broadcast after a genuinely successful response, so a failed
  // delete (network error / 403 / etc.) never wipes local folder records.
  if (method === 'DELETE' && response.ok) {
    const match = url.match(CONVERSATION_ID_PATTERN);
    if (match) notifyConversationChanged(match[1]!, 'delete');
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
  this.addEventListener('loadend', () => {
    const method = (this as any).__aichatfolders_method;
    const url = (this as any).__aichatfolders_url as string | undefined;
    if (method === 'DELETE' && this.status >= 200 && this.status < 300 && url) {
      const match = url.match(CONVERSATION_ID_PATTERN);
      if (match != null) notifyConversationChanged(match[1]!, 'delete');
    }
  });
  return originalXhrSend.apply(this, args as any);
};