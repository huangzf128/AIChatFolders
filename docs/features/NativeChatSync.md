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
- Platform-specific MAIN-world bridge script — network interception and
  `notifyConversationChanged()` dispatch.
- `src/components/RightSidebar.ts` — `aichat:native-change` listener and
  the `syncNativeChanges` gate.

## Known Limitations
- Deletion detection is per-platform and hand-coded (Claude: DELETE
  request; Gemini: `batchexecute?rpcids=qWymEb`). Adding a new platform
  requires manually finding its equivalent network signal — there is no
  generic detection strategy across platforms.
  
## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-07-30 | `<commit-hash>` | Initial implementation: native deletion sync for Claude only, built on the generalized `aichatfolders:conversation-changed` / `aichat:native-change` event contract (`NativeChangeType`) so other change types and platforms can be added without renaming events or methods. `syncNativeChanges` introduced as a `DomainSettings` toggle. |
| 2026-08-04 | `<commit-hash>` | Extended to Gemini via `batchexecute?rpcids=qWymEb` XHR interception (`gemini-main-bridge.ts`). Fixed a silent id-mismatch bug where tracking-param query strings on Gemini sidebar links leaked into stored chat ids; introduced shared `LeftSidebarAdapter.cleanChatId()` to prevent recurrence on other platforms. |


## TODO
- [ ] None currently.
