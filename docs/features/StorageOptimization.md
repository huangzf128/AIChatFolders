# Storage Layout Optimization

## Summary

Shrinks and simplifies what gets written to chrome.storage ahead of
building sync support: shorter folder ids, numeric color codes,
byte-based name limits, a compact parentId-free tree shape on disk, and
a single merged global setting item. Also splits storage across two
areas by purpose — chrome.storage.local for the (potentially large)
per-account folder tree, chrome.storage.sync for the small
cross-device global setting.

## Key Capabilities
- **Compact folder ids**: a per-account auto-increment counter
  (`StorageSchema.nextId`) replaces `Date.now().toString()` — ids are
  short decimal strings instead of 13-digit timestamps.
- **Numeric color codes**: folders store a small integer (`color`)
  resolved against `COLOR_TABLE` at render time via `resolveColor()`,
  instead of persisting the hex string. Chat leaves never persist a
  color at all.
- **Byte-based name limits**: folder names capped at 60 bytes, chat
  titles at 90 bytes, measured as UTF-8 bytes (not UTF-16 characters)
  so CJK/emoji text doesn't silently consume 2-4x the intended storage
  per character. Truncation respects character boundaries.
- **Compact on-disk tree shape**: the tree written to
  `chrome.storage.local` drops `parentId` entirely (fully derivable
  from tree position), abbreviates keys (`id`/`nm`/`cl`/`ch`/`cd`/`isC`),
  and omits any field left at its default value (unfolded, non-chat,
  empty children).
- **Unified global setting**: per-platform `enabled` +
  `syncNativeChanges` merge into one `{ td, snc }` item — numeric
  platform-code arrays (see `PLATFORM_CODES`) — stored under a single
  `chrome.storage.sync` key instead of one `chrome.storage.local` key
  per platform.
- **Storage-area abstraction**: `FolderManager.storageGet()`/
  `storageSet()` wrap both `chrome.storage.local` and
  `chrome.storage.sync` behind one Promise-based signature, since both
  areas expose an identical callback API — no duplicated plumbing per
  area.

## Technical Implementation

### Architecture
- `StoredNode` (private to `FolderManager.ts`) is the on-disk shape,
  separate from the runtime `FolderData` shape used everywhere else in
  the codebase (`RightSidebar`, `FolderEditor`, adapters). The two are
  bridged by a single pair of private methods:
  - `hydrate(nodes, parentId)` — on-disk → runtime. Reconstructs
    `parentId` from recursion position, fills in every omitted field
    with its default (`isCollapsed: false`, `isChat: false`,
    `color: DEFAULT_COLOR_CODE` for folders / `CHAT_LEAF_COLOR_CODE`
    for chats, `children: []`).
  - `dehydrate(nodes)` — runtime → on-disk. Drops `parentId`, abbreviates
    keys, omits fields at their default.
  - These are the *only* two places that touch the on-disk shape.
    Every existing CRUD method (`addFolder`, `updateFolder`,
    `deleteFolder`, `saveChatToFolder`, `reorder`, `deleteNode`,
    `renameNode`, ...) operates purely on runtime `FolderData[]` and is
    unchanged by this optimization — they call `getStorageData()` /
    `saveStorageData()`, which are the only callers of
    `hydrate()`/`dehydrate()`.
- `FolderData.items` / the `ChatItem` type were removed — dead weight
  left over from before `children` became the sole parent-child
  mechanism; nothing ever read `folder.items`.
- Global setting: `PLATFORM_CODES` (`Folder.ts`) maps platform id
  strings (`'gemini'`, `'chatgpt'`, ...) to small integers — append-only,
  existing codes must never be renumbered or reused, since they're
  persisted. `GlobalSetting { td: number[]; snc: number[] }` stores
  which platform codes are enabled / have native sync on.
  `getDomainSettings()`/`updateDomainSettings(partial, platformId)` keep
  their pre-existing per-platform signature and return shape
  (`DomainSettings`) — internally they translate to/from `td`/`snc`
  membership via `PLATFORM_CODES`, so `RightSidebar` and `options.ts`
  needed no changes beyond the storage-area switch.
- `COLOR_TABLE` (`Folder.ts`) is the same kind of append-only numeric
  table as `PLATFORM_CODES`, for the same reason (persisted codes).

### Files Involved
- `src/models/Folder.ts` — `FolderData` (parentId now documented as
  derived-not-persisted), `PLATFORM_CODES`, `COLOR_TABLE`/
  `resolveColor()`, `GlobalSetting`/`DEFAULT_GLOBAL_SETTING`; removed
  `ChatItem`/`FolderData.items`.
- `src/models/FolderManager.ts` — `StoredNode`, `hydrate()`/
  `dehydrate()`, `storageGet()`/`storageSet()`, `truncateUtf8Bytes()`,
  `withCode()`, updated `getDomainSettings()`/`updateDomainSettings()`/
  `getGlobalSetting()`/`updateGlobalSetting()`.
- `src/ui/FolderEditor.ts` — color picker now iterates `COLOR_TABLE`
  codes instead of a hardcoded hex array.
- `src/ui/RightSidebar.ts` — folder rendering resolves `folder.color`
  via `resolveColor()`; `watchDomainSettingsChanges()` listens on the
  single sync setting key instead of a per-platform local key.
- `src/options.ts` — export/import now cover both storage areas
  (`{ local, sync }` backup shape), with backward-compatible import of
  the old flat (local-only) export format.
- `src/ui/styles/layout.ts` — added a scoped `box-sizing: border-box`
  reset for all injected UI (panel, cascade menu, confirm dialog, dock
  trigger). Unrelated to storage, but found and fixed while testing
  this change: injected elements were silently relying on the host
  page's own CSS reset (e.g. Tailwind preflight on ChatGPT/Claude) to
  render at their intended size, which broke on platforms without one
  (Gemini, DeepSeek) — color-picker dots overflowed to a second row and
  the name input overflowed the panel's right edge.

## Known Limitations
- No migration path for the old schema (timestamp ids, hex colors,
  per-platform domain keys, `items` field) — acceptable pre-release,
  since there are no existing installs to preserve.
- `nextId` only increments, never reclaims ids from deleted folders.
  This is intentional (avoids id-reuse collisions), but means the
  counter's absolute value isn't a folder count.
- `chrome.storage.sync` has its own quotas (per-item size, writes/min)
  distinct from `chrome.storage.local`. The `{ td, snc }` item is tiny
  today, but there's no guard yet against it growing unexpectedly
  (e.g. many more platforms) or against `sync` being unavailable
  (enterprise policy / signed-out browser profile) — not handled by
  this change, worth revisiting when sync support is built out.

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-08-13 | `<commit-hash>` | Initial storage layout optimization: short auto-increment folder ids, numeric color codes, UTF-8 byte-based name limits, compact parentId-free on-disk tree shape (hydrate/dehydrate), unified `{ td, snc }` global setting on chrome.storage.sync, removed unused `items`/`ChatItem`. Fixed injected UI overflow on Gemini/DeepSeek caused by missing box-sizing reset. |

## TODO
- [ ] Build sync support for the folder tree itself on top of this
      layout (this doc's optimization was explicitly done in
      preparation for that work).
- [ ] Consider a schema version field if another breaking storage
      change happens post-release, to support real migration instead
      of a clean break.