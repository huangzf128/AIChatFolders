# Cloud Sync

## Summary
Optionally stores folders and saved-chat references in `chrome.storage.sync`
(the browser's own sign-in sync) instead of `chrome.storage.local`,
controlled by a single global on/off switch on the options page. Local and
cloud are two fully **independent** storage modes — switching between them
does not merge, migrate, or import data either direction. Off by default.

## Key Capabilities
- **One global switch**: a single toggle in the options page, not
  per-platform — it applies to every platform/account at once.
- **Local and cloud never touch each other.** Whichever mode is off is left
  completely untouched. Turning cloud sync on does not read or copy
  anything out of local; turning it back off does not touch whatever
  accumulated in cloud. Each mode's data is only ever read/written while
  that mode is the active one.
- **Starting cloud sync means starting fresh.** The first time cloud sync is
  turned on, `acf_folders` is empty (unless another device already
  populated it) — the user re-creates their folders there. This is a
  deliberate simplification: independently-created local folder ids/names
  across different accounts have no reliable way to be reconciled
  automatically, so no attempt is made — see Known Limitations.
- **No custom cross-device conflict resolution**: once data is written to
  `chrome.storage.sync`, propagating it to the user's other devices is left
  entirely to the browser's own sync engine.

## Technical Implementation

### Architecture
- **Two independent storage backends behind one interface.**
  `FolderManager.getStorageData()` / `saveStorageData()` — the single choke
  point every folder-tree CRUD method (`addFolder`, `saveChatToFolder`,
  `reorder`, etc.) already goes through — now branch on
  `isCloudSyncEnabled()`:
  - **Local mode**: unchanged from before this feature —
    `getLocalStorageData()` / `saveLocalStorageData()` read/write the
    per-account `acf_{platform}_{userId}` key exactly as always.
  - **Cloud mode**: `getCloudStorageData()` / `saveCloudStorageData()`
    read/write `chrome.storage.sync` instead (see key layout below).
  Neither branch reads from or writes to the other's store. There is no
  merge step anywhere in this feature.
- **Folder structure is global; chat filing is per account, even in cloud
  mode.** The folder tree itself (`acf_folders`) is one shared item across
  every platform and account — the whole point is to see the same folder
  list everywhere. Which chats are filed into which folder is tracked
  separately, per platform+account, as
  `acf_c_{platformCode}_{sanitizedUserId}_{idx}` — otherwise one account's
  growing chat list would bloat an item every other account also has to
  read, and would blow past `chrome.storage.sync`'s 8KB-per-item cap much
  sooner.
- **Chat-ref chunking.** Chat refs (`{ id, nm, fid }`) are packed into
  chunks that stay under `MAX_SYNC_CHUNK_BYTES` (7000, leaving headroom
  under the real 8192-byte quota) via `packChatRefs()`. Chunk enumeration
  on read uses `chrome.storage.sync.get(null)` filtered by key prefix
  rather than a separate chunk-count meta item — sync's 100KB total quota
  is small enough to fetch in one call, and this avoids a class of bugs
  where a meta counter and the actual chunk keys drift apart. Writes fully
  **repack** the account's chat refs from scratch each time (not
  incremental append), which trivially handles chunk count shrinking
  (deletions) at the cost of rewriting the whole set on every folder
  mutation — acceptable at the scale these lists reach in practice.
- **`AccountSettings` (e.g. `hideChat`) follows the storage mode**, same as
  folders/chat refs — local and cloud never touch each other here either.
  `getAccountSettings()` / `updateAccountSettings()` branch on
  `isCloudSyncEnabled()` directly (not through `getStorageData()` /
  `saveStorageData()`, since folder-tree CRUD has no reason to read/write
  settings on every call):
  - **Local mode**: unchanged — reads/writes the `settings` field inside
    the per-account local key (`getLocalStorageData()` /
    `saveLocalStorageData()`).
  - **Cloud mode**: reads/writes its own per-account sync item,
    `acf_s_{platformCode}_{sanitizedUserId}` — no chunking, since
    `AccountSettings` never grows large enough to need it. The `s_` prefix
    mirrors the `c_` (chat-ref) prefix so the two key families stay easy to
    tell apart at a glance.
  `getCloudStorageData()` / `saveCloudStorageData()` still round-trip
  `settings` through `StorageSchema` (reading/writing the same sync item)
  purely so folder-tree CRUD callers passing through `getStorageData()` /
  `saveStorageData()` don't clobber it — actually changing it always goes
  through `getAccountSettings()` / `updateAccountSettings()`.
- **Live cross-device/tab updates, no merge on receipt.**
  `RightSidebar.watchCloudSyncChanges()` listens on
  `chrome.storage.onChanged` for the `sync` area and simply calls
  `refresh()` — which re-reads through the same mode-routed
  `getStorageData()` and re-renders — whenever the global `cs` flag, the
  shared folder tree, or this account's own chat-ref chunks change. This
  covers both "another device changed something in cloud mode" and "the
  toggle itself flipped elsewhere," so an already-open tab swaps which
  store it's showing immediately.
- **Why the options page can't do more than flip the flag**: `options.html`
  runs as a standalone extension page with no `LeftSidebarAdapter` and no
  resolved account — it has no idea which platform/userId any given chat
  belongs to. `FolderManager.setCloudSyncEnabled()` therefore only flips
  the `cs` flag in the shared `acf_setting` item; each open tab's own
  content-script instance picks up the change via the watcher above.

### Interaction Logic / Behavior
- Toggling "Sync across devices" on the options page only ever writes one
  small flag — nothing else happens synchronously from that page.
- An already-open tab notices the flag flip via `onChanged` and immediately
  re-renders from the newly-active store.
- A freshly opened tab just reads whichever store is currently active — no
  special first-load behavior beyond the normal `refresh()` in `init()`.
- Turning cloud sync back off does not delete anything from
  `chrome.storage.sync`; that data stays there (and reappears if the toggle
  is turned back on later) but is invisible while local mode is active.

### Files Involved
- `src/models/Folder.ts` — `GlobalSetting.cs` flag.
- `src/models/FolderManager.ts` — `isCloudSyncEnabled` / `setCloudSyncEnabled`;
  `getLocalStorageData` / `saveLocalStorageData` (renamed from the original
  always-local pair); `getCloudStorageData` / `saveCloudStorageData`; the
  mode-routed `getStorageData` / `saveStorageData`; `dehydrateFoldersOnly`,
  `extractChatRefs` / `graftChatRefs`, `packChatRefs`, `readSyncFolders` /
  `writeSyncFolders`, `readChatRefsFromSync` / `writeChatRefsToSync`; the
  mode-routed `getAccountSettings` / `updateAccountSettings`, plus
  `getAccountSettingsSyncKey` / `getSyncAccountSettings` /
  `saveSyncAccountSettings` for the cloud-mode branch.
- `src/ui/RightSidebar.ts` — `watchCloudSyncChanges` (also re-reads
  `AccountSettings` and refreshes the hide-toggle UI when this account's
  `acf_s_*` item changes on another device).
- `src/options.ts`, `options.html`, `_locales/*/messages.json` — the single
  global toggle UI.

## Known Limitations
- **No data migration between modes, by design.** Enabling cloud sync does
  not import existing local folders; disabling it does not export cloud
  folders back to local. The user manually recreates their folder
  structure in whichever mode they're newly entering. (An explicit
  non-goal per project discussion — automatic reconciliation between
  independently-assigned local folder ids across accounts was judged not
  worth the complexity/risk for v1.)
- Cloud mode only updates a tab's UI while that tab is open (on load, or
  live via `onChanged`). If a platform isn't visited for a long time after
  another device changes the shared tree, its view simply lags until it's
  next opened — there's no background sync.
- Concurrent-edit conflicts between two devices both in cloud mode at the
  same time (e.g. renaming the same folder differently at once) are not
  resolved by this extension — left entirely to `chrome.storage.sync`'s own
  eventual consistency (last write per key wins).
- The existing Export/Import JSON feature (options page) only reads/writes
  `chrome.storage.local`; it does not yet cover cloud-mode data.

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-08-15 | `<commit-hash>` | Initial implementation: global cloud-sync toggle; two fully independent storage modes (no merge) routed through `FolderManager.getStorageData()`/`saveStorageData()`; shared folder-tree sync (`acf_folders`); per-account chunked chat-ref sync (`acf_c_*`). |
| 2026-08-17 | `<commit-hash>` | `AccountSettings` (e.g. `hideChat`) now follows the storage mode instead of always being local — cloud mode reads/writes its own per-account `acf_s_{platformCode}_{userId}` sync item. `RightSidebar.watchCloudSyncChanges()` now also picks up cross-device changes to this item and refreshes the hide-toggle UI. |

## TODO
- [ ] Extend Export/Import JSON to cover cloud-mode data.
- [ ] Consider a lightweight "last synced at" indicator on the options page.
- [ ] Revisit background reconciliation (e.g. via the service worker) if the
      "only updates while a tab is open" limitation turns out to matter.
