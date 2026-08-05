# Native Chat Sync

## Summary

Mirrors changes made through a platform's own native UI — deletion and
title renames — onto chats already saved in local folders, so a folder
entry never silently points at a chat that no longer exists (or no
longer has that title) on the native side.

## Key Capabilities
- **Automatic Deletion Sync**: Deleting a conversation through the
  platform's native UI removes the corresponding node from the folder
  tree, without the user having to manually clean it up.
- **Automatic Rename Sync**: Renaming a conversation through the
  platform's native UI updates the title of every matching node in the
  folder tree — including all copies, if the same chat was saved into
  more than one folder.  
- **Extensible Change Type**: The event contract carries a `type` field
  (`NativeChangeType`) rather than being delete-specific, so future native
  signals (e.g. rename) are additive — no new event name or listener
  wiring is required to support them.
- **User-Controlled Toggle**: Sync can be turned off from the settings
  page, since it performs an automatic, destructive local action based on
  network-request pattern-matching.

## Technical Implementation

### Architecture
- `NativeChangeType` (`src/models/Folder.ts`) is a string union
  (`'delete' | 'rename'`) describing what kind of native change is being
  reported for a chat. New native signals are added here as new union
  members, not as new events.
- The event contract is a single pair of events shared by all platforms,
  carrying `{ chatId: string; type: NativeChangeType; newTitle?: string }`:
  - `aichatfolders:conversation-changed` — dispatched in the page's MAIN
    world by a platform-specific bridge script, since native change
    signals (e.g. Claude's DELETE network request) are only observable
    from MAIN world, not from the isolated content-script world.
  - `aichat:native-change` — re-broadcast into the isolated world by
    `LeftSidebarAdapter.initNativeChatSync()`, which `RightSidebar`
    listens for.
- `LeftSidebarAdapter.initNativeChatSync()` is a concrete (non-abstract)
  base-class method rather than per-adapter logic, since bridging the two
  event names is identical for every platform — it only depends on the
  agreed-upon payload shape, not on any platform-specific DOM/selector
  details. A platform's bridge script only needs to dispatch
  `aichatfolders:conversation-changed` with the right payload, and this
  method takes care of the rest.
- `RightSidebar`'s `aichat:native-change` listener switches on
  `detail.type` to route to the appropriate `FolderManager` operation
  (`deleteNode` for `'delete'`), guarded by the `syncNativeChanges` toggle.
- `syncNativeChanges` lives in `DomainSettings`, not `AccountSettings` —
  it is managed from the settings page, which may be opened before an
  account is resolved, so it must not depend on
  `LeftSidebarAdapter.getResolvedAccountKey()`. This is a different
  storage key (`acf_domain_{platformId}`) from the account-scoped
  `AccountSettings` (`acf_{platformId}_{userId}`) used by right-sidebar
  toggles like `hideChat`.
- The event contract's `{ chatId, type, newTitle? }` payload is shared
  by both change types; `newTitle` is only populated for `'rename'`.
- `FolderManager.renameNode(id, newTitle)` walks the *entire* tree
  rather than stopping at the first match — unlike a lookup that only
  needs one hit, a rename must be applied to every node sharing that
  id, since the same chat can be saved into multiple folders.
  `deleteNode()` already had this property naturally (it rebuilds the
  tree via `filter`/`map`, which re-evaluates every node at every
  level); `renameNode()` was fixed to match after initially short-
  circuiting on the first match.

### Interaction Logic (RightSidebar)
- On a `'delete'` change: `FolderManager.deleteNode(chatId)` removes the
  node from the tree, the tree is re-rendered, and if the chat no longer
  exists anywhere in the tree its id is dropped from `savedChatIds`
  (relevant when `HideChats` is active, so the native row correctly
  becomes restorable elsewhere).
- If `syncNativeChanges` is off, the event is still received but ignored
  — the folder entry is left in place even though the native chat is
  gone.
- On a `'delete'` change: `FolderManager.deleteNode(chatId)` removes the
  node from the tree, the tree is re-rendered, and if the chat no longer
  exists anywhere in the tree its id is dropped from `savedChatIds`
  (relevant when `HideChats` is active, so the native row correctly
  becomes restorable elsewhere).
- On a `'rename'` change: `FolderManager.renameNode(chatId, newTitle)`
  updates every matching node's `name` and the tree is re-rendered.
- If `syncNativeChanges` is off, the event is still received but ignored
  — the folder entry is left in place even though the native chat is
  gone or renamed.  

### Files Involved
- `src/models/Folder.ts` — `NativeChangeType`, `DomainSettings`,
  `DEFAULT_DOMAIN_SETTINGS`.
- `src/models/FolderManager.ts` — `getDomainSettings()` /
  `updateDomainSettings()`, domain-scoped storage key.
- `src/adapters/LeftSidebar.ts` — `initNativeChatSync()` (shared bridge
  listener); also `cleanChatId()`, a shared utility stripping query
  string / fragment from a raw href-derived chat id.
- Platform-specific MAIN-world bridge scripts — network interception and
  `notifyConversationChanged()` dispatch:
  - `src/bridges/claude-main-bridge.ts` — delete: `DELETE
    /chat_conversations/{uuid}`. rename: `PUT` to the same endpoint,
    title in the JSON body.
  - `src/bridges/gemini-main-bridge.ts` — delete: XHR,
    `batchexecute?rpcids=qWymEb`, id from `f.req`. rename: XHR,
    `batchexecute?rpcids=MUAZcd`, id/title pair nested in the inner
    payload's third element.
  - `src/bridges/chatgpt-main-bridge.ts` — delete: `DELETE
    /backend-api/conversation/id/{uuid}`. rename: `POST` to the same
    `{uuid}` path plus `/rename`, title in the JSON body (read via
    `Request.clone().text()` as a fallback, since `init.body` isn't
    always populated for this call).
  - `src/bridges/deepseek-main-bridge.ts` — delete: `POST
    /api/v0/chat_session/delete`, id in the JSON body. rename: `POST
    /api/v0/chat_session/update_title`, id and title both in the JSON
    body.

## Known Limitations
- Deletion detection is per-platform and hand-coded — there is no generic
  detection strategy across platforms:
  - Claude: `DELETE` request to `/chat_conversations/{uuid}`.
  - Gemini: `batchexecute?rpcids=qWymEb` (XHR, id inside `f.req`).
  - ChatGPT: `DELETE /backend-api/conversation/id/{uuid}` (id in the URL).
  - DeepSeek: `POST /api/v0/chat_session/delete` (id in the JSON body,
    not the URL).
- On ChatGPT, sync lags a few seconds behind the visible deletion in the
  UI. The extension broadcasts only once the real `DELETE` request
  resolves successfully, and ChatGPT's own client appears to delay
  issuing that request well after the row disappears from the sidebar.
  This is believed to be inherent to ChatGPT's client behavior, not the
  interception logic — reacting earlier (e.g. on click) was deliberately
  avoided, since it would risk deleting the local reference before the
  user confirms/if they cancel.

- Rename detection is per-platform and hand-coded, same as deletion —
  there is no generic detection strategy across platforms:
  - Claude: `PUT` to `/chat_conversations/{uuid}`.
  - Gemini: `batchexecute?rpcids=MUAZcd` (XHR, id/title inside `f.req`).
  - ChatGPT: `POST /backend-api/conversation/id/{uuid}/rename` (id in
    the URL, title in the body).
  - DeepSeek: `POST /api/v0/chat_session/update_title` (id and title
    both in the JSON body, not the URL).

  
## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-07-30 | `<commit-hash>` | Initial implementation: native deletion sync for Claude only, built on the generalized `aichatfolders:conversation-changed` / `aichat:native-change` event contract (`NativeChangeType`) so other change types and platforms can be added without renaming events or methods. `syncNativeChanges` introduced as a `DomainSettings` toggle. |
| 2026-08-04 | `<commit-hash>` | Extended to Gemini via `batchexecute?rpcids=qWymEb` XHR interception (`gemini-main-bridge.ts`). Fixed a silent id-mismatch bug where tracking-param query strings on Gemini sidebar links leaked into stored chat ids; introduced shared `LeftSidebarAdapter.cleanChatId()` to prevent recurrence on other platforms. |
| 2026-08-04 | `<commit-hash>` | Extended to ChatGPT via fetch interception of `DELETE /backend-api/conversation/id/{uuid}` (`chatgpt-main-bridge.ts`), reusing the fetch-primary/XHR-fallback pattern from `claude-main-bridge.ts`. Extended to DeepSeek via fetch interception of `POST /api/v0/chat_session/delete` (`deepseek-main-bridge.ts`), reading `chat_session_id` from the JSON request body since the id isn't in the URL. All four supported platforms now have native deletion sync. |
| 2026-08-05 | `<commit-hash>` | Extended `NativeChatSync` from delete-only to also cover native title renames, across all four platforms (Claude `PUT`, ChatGPT `POST .../rename`, Gemini `batchexecute?rpcids=MUAZcd`, DeepSeek `POST update_title`). Fixed `FolderManager.renameNode()` short-circuiting on the first match instead of updating every node sharing an id across multiple folders. |

## TODO
- [ ] None currently.
