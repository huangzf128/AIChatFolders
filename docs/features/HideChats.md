# Hide/Show Categorized Chats in Native History

## Summary

Adds an eye-icon toggle in the right panel header that hides/shows native sidebar rows for chats that are already saved to a folder, so the same chat doesn't appear twice (once in the native list, once in the folder tree).

## Key Capabilities
- **Clean Sidebar Experience**: Reduces visual noise by hiding archived/organized conversations from the daily chat list while keeping them easily accessible via the AIChatFolders drawer panel.
- **Toggle Visibility**: Users can easily toggle between showing all native chat histories or hiding those already sorted into folders.


## Technical Implementation
 
### Architecture
- `LeftSidebarAdapter` now owns the row-lookup logic itself, instead of each
  adapter reimplementing it. Every platform shares the same
  container → rows → link → chatId traversal, so the shared implementation
  lives in the base class, and each adapter only declares three selectors:
  - `historySelector` — CSS selector for the native list container(s).
    `querySelectorAll` is used rather than `querySelector`, since some
    platforms render more than one independent section (e.g. Claude's
    "Starred" and "Recents" are two separate `<ul class="flex flex-col">`
    elements).
  - `rowSelector` — CSS selector (relative to the container) identifying a
    single row. For platforms where the row wraps the link in a non-anchor
    element (Gemini, ChatGPT, Claude), this is the wrapper. For DeepSeek,
    where the row *is* the anchor itself, `rowSelector` is set equal to
    `linkSelector`.
  - `linkSelector` — CSS selector identifying the chat's anchor link, whose
    URL's last path segment is the chat id.
- `getChatRows()` and `getChatRowById(id)` are concrete (non-abstract)
  methods on `LeftSidebarAdapter`; they are no longer per-platform virtual
  methods, since the traversal logic itself doesn't vary by platform —
  only the three selectors do.
- `FolderManager` persists a `hideChat` setting alongside the folder tree,
  keyed per storage key. The legacy read path for the pre-`settings`
  storage format (a bare `FolderData[]`) has been removed, since there are
  no existing installs predating that schema.

   
### Interaction Logic (RightSidebar)
- Clicking the toggle button switches the EYE / EYE_OFF icon and performs a
  full hide/show pass over the current list.
- Saving a chat to a folder immediately hides its native row.
- Deleting a chat leaf or an entire folder restores the corresponding native
  row(s).
- A `MutationObserver` (batched via `requestAnimationFrame`) continuously
  watches the native sidebar for lazily-rendered rows, so newly loaded rows
  (infinite scroll) are correctly hidden/shown, and the initial hydration
  case is covered as well.

  ### Files Involved
- `src/adapters/LeftSidebar.ts` — shared `getChatRows`/`getChatRowById`
  implementation and the three abstract selector properties.
- `src/adapters/GeminiAdapter.ts`, `ChatGPTAdapter.ts`, `ClaudeAdapter.ts`,
  `DeepSeekAdapter.ts` — per-platform `historySelector`/`rowSelector`/
  `linkSelector` values.
- `src/components/RightSidebar.ts` — toggle UI, hide/show pass, and the
  `MutationObserver` that keeps hidden state in sync with lazy rendering.
- `src/models/FolderManager.ts` — persists the `hideChat` setting.

## Known Limitations
- DeepSeek's row is the anchor element itself rather than a separate row
  wrapper; if DeepSeek's DOM changes such that hover-only controls (e.g. the
  row's action menu button) render outside the `<a>`, hiding the row would
  leave those controls visible. Re-verify `linkSelector`/`rowSelector` if
  DeepSeek's markup changes.

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-07-28 | `<commit-hash>` | Initial implementation: hide categorized chats from the native sidebar, across all four platforms (Gemini, ChatGPT, Claude, DeepSeek). Row-lookup logic consolidated into `LeftSidebarAdapter`.  |
| 2026-07-28 | `<commit-hash>` | Fixed native rows not being restored after deleting a saved chat/folder while hide mode was active. `savedChatIds` was only refreshed inside `refresh()`, so the mutation-observer-triggered full scan (`applyHideToAllRows`) re-hid the row using stale data right after `showRowById` un-hid it. |

## TODO
- [ ] None currently.

