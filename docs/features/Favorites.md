# Favorites (Starred Chats)

## Summary

Lets a chat already saved to a folder be starred as a favorite. A
favorited chat shows a filled star before its title in the folder panel;
an unfavorited chat shows a hover-only outline star action next to its
delete button. There is no separate favorites view or sort-to-top
behavior — this is purely a visual marker on the chat as it already sits
in the tree.

## Key Capabilities
- **One-click favorite**: hovering a chat leaf reveals a star action
  button (alongside the existing delete button); clicking it favorites
  the chat.
- **One-click unfavorite**: a favorited chat shows a filled, always-visible
  star immediately before its title; clicking that star unfavorites it.
  The hover-only action button is not shown for an already-favorited
  chat — only one star is ever visible per chat at a time.
- **Follows the chat, not the reference**: if the same chat is saved into
  more than one folder, favoriting/unfavoriting it in one place updates
  every copy, same as native rename sync already does for titles.
- **Independent of storage mode**: the favorite flag persists identically
  whether local or cloud storage mode is active (see Architecture).

## Technical Implementation

### Architecture
- `FolderData.isFavorite` (`src/models/Folder.ts`) is a new optional
  boolean field on the runtime tree shape. It's only meaningful for chat
  leaves (`isChat: true`); folders never read or write it.
- **On-disk shapes**: both places a chat leaf is persisted gained a new
  omit-when-default field, following this file's existing abbreviated-key
  convention:
  - `StoredNode.fv?: 1` (`FolderManager.ts`) — the local-storage /
    cloud-folder-tree on-disk node shape. `hydrate()`/`dehydrate()` are
    the only two places that translate this to/from the runtime
    `isFavorite` boolean.
  - `SyncChatRef.fav?: 1` (`FolderManager.ts`) — cloud mode tracks which
    chats are filed where separately from the shared folder tree (see
    `docs/features/CloudSync.md`), so the favorite flag has to be
    threaded through this second shape too: `extractChatRefs()` sets it
    when writing, `graftChatRefs()` reads it back when reconstructing the
    mixed tree on load. Missing this would mean a chat's favorite state
    silently only worked in local mode.
- `FolderManager.setFavorite(id, isFavorite)` is the single entry point
  for changing the flag, mirroring the shape of the existing
  `renameNode(id, newName)`: it walks the *entire* tree (not just the
  first match) and applies the flag to every node sharing that id, since
  the same chat can be saved into multiple folders. Goes through the same
  mode-routed `getFolders()`/`saveFolders()` as every other tree mutation,
  so it transparently works in both local and cloud storage mode with no
  extra branching of its own.
- `ICONS.STAR` (outline) and `ICONS.STAR_FILLED` (solid, gold) are the two
  new icons (`src/ui/icons.ts`), matching the existing Lucide-style SVG
  icon set already used elsewhere in the panel.

### Interaction Logic (RightSidebar)
- `renderFolderTree()`'s chat-leaf branch renders one of two mutually
  exclusive elements based on `folder.isFavorite`:
  - **Favorited**: a filled star (`ICONS.STAR_FILLED`) rendered inside
    `.aichat-folder-title`, immediately before the `<a>` chat link — not
    inside the anchor itself, so clicking the star toggles favorite state
    without triggering chat navigation, and isn't clipped by the anchor's
    own `text-overflow: ellipsis`.
  - **Not favorited**: an outline star (`ICONS.STAR`) rendered inside
    `.aichat-actions`, alongside the existing delete button. Hidden by
    default (`opacity: 0`), fading in on row hover exactly like the
    delete button already does.
  - Both elements share a common `.aichat-favorite-toggle` class plus a
    `data-favorite="0"|"1"` attribute recording their own current state,
    so the single click handler in `bindGlobalEvents()` can read which
    way to toggle directly off the clicked element — no tree lookup
    needed just to determine direction.
- The click handler calls `FolderManager.setFavorite(id, !isFavorite)`
  and re-renders via `this.render(updated)`, the same pattern used by
  every other tree-mutating action in this file (edit, delete, collapse).
  No special-casing of `savedChatIds` or the hide-native-row logic is
  needed — favoriting doesn't change whether a chat is "saved to a
  folder" in that sense.

### Files Involved
- `src/models/Folder.ts` — `FolderData.isFavorite`.
- `src/models/FolderManager.ts` — `StoredNode.fv`, `SyncChatRef.fav`,
  `hydrate()`/`dehydrate()`, `extractChatRefs()`/`graftChatRefs()`,
  `setFavorite()`.
- `src/ui/icons.ts` — `ICONS.STAR`, `ICONS.STAR_FILLED`.
- `src/ui/RightSidebar.ts` — `renderFolderTree()` chat-leaf branch,
  `.aichat-favorite-toggle` click handler in `bindGlobalEvents()`.
- `src/ui/styles/folder.ts` — `.favorite-btn` (hover action button) and
  `.aichat-favorite-star` (always-visible pre-title star) styles.

## Known Limitations
- No favorites-only view or sort-to-top — this is a pure visual marker on
  the chat exactly where it already sits in the tree. Could be added
  later as a filter/sort option if there's demand.
- No native-platform equivalent to sync against (unlike delete/rename),
  since "favorite" is purely a concept this extension introduces — there
  is nothing to intercept from the platform's own network requests.

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-09-11 | `<commit-hash>` | Initial implementation: per-chat favorite flag, toggleable from a hover action button (unfavorited) or an always-visible pre-title star (favorited), synced across both local and cloud storage modes. |

## TODO
- [ ] None currently.
