# Chat Markers

## Summary

Replaces the former single boolean "favorite" flag with a numeric marker
system that supports multiple visual badges on chat leaves. A chat can
carry one of four markers (⭐ Favorite, 🟩 Green, 🟥 Red, 🔵 In progress),
shown as a small icon badge before its title. Hovering the "+" action
button in the actions row reveals a horizontal picker strip; clicking a
marker option sets it. Clicking an already-visible badge clears it.

## Key Capabilities
- **Four marker types**: Favorite (gold star), Green (green square),
  Red (red square), In progress (half-filled blue circle). Each has a
  distinct color and shape for quick visual scanning.
- **One-click set**: hovering a chat leaf's "+" action button reveals a
  horizontal picker strip to the left of the button; clicking an option
  sets that marker on the chat.
- **One-click clear**: a marked chat shows its badge immediately before
  the title; clicking that badge removes the marker.
- **Follows the chat, not the reference**: if the same chat is saved into
  more than one folder, setting/clearing a marker in one place updates
  every copy, same as native rename sync already does for titles.
- **Independent of storage mode**: the marker persists identically
  whether local or cloud storage mode is active (see Architecture).
- **Backward compatible**: old `fv:1` / `fav:1` favorite flags are
  automatically migrated to marker code 1 on read; new data is written
  only in the new `mk` format.

## Technical Implementation

### Architecture
- `FolderData.marker` (`src/models/Folder.ts`) is an optional numeric
  field on the runtime tree shape. Absent means no marker. Only
  meaningful for chat leaves (`isChat: true`); folders never read or
  write it.
- `MARKER_TABLE` (`src/models/Folder.ts`) maps marker codes to
  human-readable labels (used for tooltips). It follows the same
  append-only rule as `COLOR_TABLE` and `PLATFORM_CODES`: never renumber
  or reuse an existing code; only append new ones.
  ```
  1 → 'Favorite'
  2 → 'Green'
  3 → 'Red'
  4 → 'In progress'
  ```
- **On-disk shapes**: both places a chat leaf is persisted use a new
  `mk` field (omit-when-unset), and retain the legacy fields as
  read-only migration sources:
  - `StoredNode.mk?: number` / `StoredNode.fv?: 1` (local storage /
    cloud folder tree). `hydrate()` reads `n.mk ?? (n.fv === 1 ? 1 : 0)`;
    `dehydrate()` writes only `out.mk`, never `fv`.
  - `SyncChatRef.mk?: number` / `SyncChatRef.fav?: 1` (cloud sync
    refs). `graftChatRefs()` reads `ref.mk ?? (ref.fav === 1 ? 1 : 0)`;
    `extractChatRefs()` writes only `ref.mk`, never `fav`.
- `FolderManager.setMarker(id, marker)` is the single entry point for
  changing the marker. `marker` is a code from `MARKER_TABLE` or `null`
  to clear. It walks the entire tree and applies the change to every
  node sharing that id (same all-matches semantics as `renameNode()`).
  Goes through the same mode-routed `getFolders()`/`saveFolders()` as
  every other tree mutation, so it works in both local and cloud storage
  mode with no extra branching.
- `MARKER_ICONS` (`src/ui/icons.ts`) maps marker codes to SVG strings.
  The same SVG is used both in the picker panel and as the badge before
  a title.

### Interaction Logic (RightSidebar)
- `renderFolderTree()`'s chat-leaf branch:
  - **Badge**: if `folder.marker` is set and `MARKER_ICONS[marker]`
    exists, a badge span (`.aichat-marker-badge`) is rendered inside
    `.aichat-folder-title`, immediately before the `<a>` chat link.
    Clicking it calls `setMarker(id, null)` to clear.
  - **Add button + picker**: if no marker is set, a "+" button
    (`.aichat-marker-add`) is shown in `.aichat-actions`. Hovering the
    wrapping container (`.aichat-marker-wrap`) reveals a horizontal
    picker strip (`.aichat-marker-picker`) to the left of the "+".
    Each option (`.aichat-marker-option`) carries a `data-marker`
    attribute; clicking it calls `setMarker(id, code)`.
- The click handler in `bindGlobalEvents()` delegates via
  `.aichat-marker-badge` / `.aichat-marker-option` classes, reads the
  id and marker code directly off the clicked element, and re-renders
  via `this.render(updated)`.

### Files Involved
- `src/models/Folder.ts` — `FolderData.marker`, `MARKER_TABLE`.
- `src/models/FolderManager.ts` — `StoredNode.mk`/`fv`, `SyncChatRef.mk`/`fav`,
  `hydrate()`/`dehydrate()`, `extractChatRefs()`/`graftChatRefs()`,
  `setMarker()`.
- `src/ui/icons.ts` — `MARKER_ICONS`.
- `src/ui/RightSidebar.ts` — `renderFolderTree()` chat-leaf branch,
  `.aichat-marker-badge` / `.aichat-marker-option` click handler in
  `bindGlobalEvents()`.
- `src/ui/styles/folder.ts` — `.aichat-marker-badge`, `.aichat-marker-wrap`,
  `.aichat-marker-add`, `.aichat-marker-picker` styles.

## Migration from Favorites

The previous `isFavorite: boolean` / `fv?: 1` / `fav?: 1` system is
fully backward compatible:

| Old field | New field | Migration rule |
|-----------|-----------|----------------|
| `StoredNode.fv: 1` | `StoredNode.mk: 1` | `hydrate()`: `n.mk ?? (n.fv === 1 ? 1 : 0)` |
| `SyncChatRef.fav: 1` | `SyncChatRef.mk: 1` | `graftChatRefs()`: `ref.mk ?? (ref.fav === 1 ? 1 : 0)` |

On write, only `mk` is ever produced — `fv` and `fav` are never written
again. After one save cycle the legacy fields are naturally absent from
the stored data.

## Known Limitations
- No marker-only view or sort/filter — markers are purely visual badges
  on the chat exactly where it already sits in the tree. Could be added
  later as a filter/sort option if there's demand.
- No native-platform equivalent to sync against (unlike delete/rename),
  since markers are purely a concept this extension introduces — there
  is nothing to intercept from the platform's own network requests.

## Revision History
| Date | Description |
|------|-------------|
| 2026-10-23 | Replaced single boolean favorite with numeric marker system (4 types). Backward-compatible migration from `fv`/`fav` to `mk`. |
| 2026-09-11 | Initial implementation: per-chat favorite flag, toggleable from a hover action button (unfavorited) or an always-visible pre-title star (favorited), synced across both local and cloud storage modes. |