# Native Chat Sync

## Summary

Mirrors changes made through a platform's own native UI — currently
deletion, with rename planned — onto chats already saved in local
folders, so a folder entry never silently points at a chat that no
longer exists (or no longer has that title) on the native side.

## Key Capabilities
- **Automatic Deletion Sync**: Deleting a conversation through the
  platform's native UI removes the corresponding node from the folder
  tree, without the user having to manually clean it up.
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

### Interaction Logic (RightSidebar)
- On a `'delete'` change: `FolderManager.deleteNode(chatId)` removes the
  node from the tree, the tree is re-rendered, and if the chat no longer
  exists anywhere in the tree its id is dropped from `savedChatIds`
  (relevant when `HideChats` is active, so the native row correctly
  becomes restorable elsewhere).
- If `syncNativeChanges` is off, the event is still received but ignored
  — the folder entry is left in place even though the native chat is
  gone.

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
  - `src/bridges/claude-main-bridge.ts` — `fetch`/XHR, id from URL
    (`/chat_conversations/{uuid}`).
  - `src/bridges/gemini-main-bridge.ts` — XHR, id from `f.req` body
    (`batchexecute?rpcids=qWymEb`).
  - `src/bridges/chatgpt-main-bridge.ts` — `fetch`/XHR, id from URL
    (`/backend-api/conversation/id/{uuid}`).
  - `src/bridges/deepseek-main-bridge.ts` — `fetch`/XHR, id from JSON
    body (`POST /api/v0/chat_session/delete`).
- `src/ui/RightSidebar.ts` — `aichat:native-change` listener and the
  `syncNativeChanges` gate.

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

  
## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-07-30 | `<commit-hash>` | Initial implementation: native deletion sync for Claude only, built on the generalized `aichatfolders:conversation-changed` / `aichat:native-change` event contract (`NativeChangeType`) so other change types and platforms can be added without renaming events or methods. `syncNativeChanges` introduced as a `DomainSettings` toggle. |
| 2026-08-04 | `<commit-hash>` | Extended to Gemini via `batchexecute?rpcids=qWymEb` XHR interception (`gemini-main-bridge.ts`). Fixed a silent id-mismatch bug where tracking-param query strings on Gemini sidebar links leaked into stored chat ids; introduced shared `LeftSidebarAdapter.cleanChatId()` to prevent recurrence on other platforms. |
| 2026-08-04 | `<commit-hash>` | Extended to ChatGPT via fetch interception of `DELETE /backend-api/conversation/id/{uuid}` (`chatgpt-main-bridge.ts`), reusing the fetch-primary/XHR-fallback pattern from `claude-main-bridge.ts`. Extended to DeepSeek via fetch interception of `POST /api/v0/chat_session/delete` (`deepseek-main-bridge.ts`), reading `chat_session_id` from the JSON request body since the id isn't in the URL. All four supported platforms now have native deletion sync. |


## TODO
- [ ] None currently.
