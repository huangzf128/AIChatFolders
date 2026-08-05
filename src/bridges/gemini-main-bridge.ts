// src/bridges/gemini-main-bridge.ts
// Runs in the MAIN world (page's own JS context). Patching
// XMLHttpRequest only intercepts calls made from the SAME world —
// content scripts in the isolated world have their own copy of XHR, so
// patching it there would never see Gemini's own network calls. This
// mirrors claude-main-bridge.ts's reasoning for the same "world": "MAIN"
// requirement.

/** Gemini's internal batchexecute RPC id for "delete conversation" (found via network tab). */
const DELETE_RPC_ID = 'qWymEb';
/** Gemini's internal batchexecute RPC id for "rename conversation" (found via network tab). */
const RENAME_RPC_ID = 'MUAZcd';


/** Broadcasts a native chat change (delete, rename, ...) to the isolated world (GeminiAdapter). */
function notifyConversationChanged(
  chatId: string,
  type: 'delete' | 'rename',
  extra?: { newTitle?: string },
): void {
  window.dispatchEvent(new CustomEvent('aichatfolders:conversation-changed', { detail: { chatId, type, ...extra } }));
}

/**
 * Extracts the deleted conversation id from a batchexecute request body.
 *
 * Gemini's batchexecute protocol wraps the actual RPC args as a JSON
 * string nested inside the `f.req` form field, itself wrapped in an
 * envelope array, e.g.:
 *   f.req=[[["qWymEb","[\"c_696cc3d3152973ca\",[1,null,0,1]]",null,"generic"]]]
 * The delete RPC's inner payload's first element is the chat id, prefixed
 * with "c_" — this prefix is stripped, since native sidebar links
 * (`<a href="/app/{id}">`) use the bare id without it.
 */
function extractDeletedChatId(rawBody: string): string | null {
	try {
		const params = new URLSearchParams(rawBody);
		const fReq = params.get('f.req');
		if (!fReq) return null;
		const envelope = JSON.parse(fReq);
		const calls = envelope?.[0];
		if (!Array.isArray(calls)) return null;
		for (const call of calls) {
		const [rpcId, innerJson] = call as [string, string];
		if (rpcId !== DELETE_RPC_ID || typeof innerJson !== 'string') continue;
		const inner = JSON.parse(innerJson);
		const rawId = inner?.[0];
		if (typeof rawId === 'string') return rawId.startsWith('c_') ? rawId.slice(2) : rawId;
		}
	} catch (e) {
		console.warn('[AIChatFolders] Failed to parse Gemini batchexecute body.', e);
	}
	return null;
}

/**
 * Extracts the renamed conversation's id and new title from a batchexecute
 * request body.
 *
 * The rename RPC's inner payload shape (after parsing the inner JSON
 * string) is:
 *   [null, [["title"]], ["c_<chatId>", "<newTitle>"]]
 * — a null placeholder, a list naming which field changed, then the
 * id/title pair itself. As with delete, the "c_" id prefix is stripped.
 */
function extractRenamedChat(rawBody: string): { chatId: string; newTitle: string } | null {
	try {
		const params = new URLSearchParams(rawBody);
		const fReq = params.get('f.req');
		if (!fReq) return null;
		const envelope = JSON.parse(fReq);
		const calls = envelope?.[0];
		if (!Array.isArray(calls)) return null;
		for (const call of calls) {
		const [rpcId, innerJson] = call as [string, string];
		if (rpcId !== RENAME_RPC_ID || typeof innerJson !== 'string') continue;
			const inner = JSON.parse(innerJson);
			const idAndTitle = inner?.[2];
			const rawId = idAndTitle?.[0];
			const newTitle = idAndTitle?.[1];
			if (typeof rawId === 'string' && typeof newTitle === 'string') {
				return { chatId: rawId.startsWith('c_') ? rawId.slice(2) : rawId, newTitle };
			}
		}
	} catch (e) {
		console.warn('[AIChatFolders] Failed to parse Gemini rename batchexecute body.', e);
	}
	return null;
}

/** True if the given URL is a batchexecute call carrying the delete RPC id. */
function isDeleteRequestUrl(url: string): boolean {
  return url.includes('batchexecute') && url.includes(`rpcids=${DELETE_RPC_ID}`);
}

/** True if the given URL is a batchexecute call carrying the rename RPC id. */
function isRenameRequestUrl(url: string): boolean {
  return url.includes('batchexecute') && url.includes(`rpcids=${RENAME_RPC_ID}`);
}

// ─── Native Conversation Deletion & Rename Interception (XHR) ─────────────
// Confirmed via network tab: Gemini's batchexecute calls go through XHR,
// not fetch. XHR is patched as the primary (not belt-and-braces) path here.
const originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
  (this as any).__aichatfolders_url = typeof url === 'string' ? url : url.toString();
  return originalXhrOpen.apply(this, [method, url, ...rest] as any);
};
const originalXhrSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
  const url = (this as any).__aichatfolders_url as string | undefined;
  if (url && typeof body === 'string') {
    // Only broadcast after a genuinely successful response, so a failed
    // delete/rename never touches local folder records.
    if (isDeleteRequestUrl(url)) {
      this.addEventListener('loadend', () => {
        if (this.status >= 200 && this.status < 300) {
          const chatId = extractDeletedChatId(body);
          if (chatId) notifyConversationChanged(chatId, 'delete');
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
