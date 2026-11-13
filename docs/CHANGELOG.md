# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.3.6] - 2026-11-13

### Fixed

* Fixed ChatGPT "Add to Folder" menu item not appearing after ChatGPT started pre-rendering the context menu inside every chat row (`div[role="listitem"]`). The menu is now resolved from the click target (`trigger.closest(rowSelector).querySelector(itemSelector)`) instead of a global `document.querySelector`, which previously matched the hidden menu of the first row and injected nothing.
* Fixed the injected menu item drifting upward in the native menu for chats inside a project. Such rows mount extra items (e.g. "Remove from project") after our injection, so a `MutationObserver` now keeps our item pinned as the last native entry.
* Fixed the folder cascade menu being covered by ChatGPT's native menu. All cascade levels are now mounted inside ChatGPT's own menu container instead of `#browser-sidebar-popover`/`document.body`, so they share the same ancestor chain and stacking context as ChatGPT's native submenus.
* Fixed the folder cascade menu not opening on a chat row that had already been visited once, after another row's menu had been opened in between. The injected item stays mounted while the native menu is closed, so re-entering the row skipped re-injection and the cached menu container still pointed at the previous row; the container is now re-resolved from the hovered item every time the submenu opens.

### Changed

* Opening a submenu at a given depth now removes any other submenu previously opened at the same depth, so hovering a second sibling folder no longer leaves the first sibling's submenu on screen.
* `createMenuItem()` now accepts the click target as an optional argument so adapters whose menu renders inside the clicked row can locate it. Existing adapters (Claude, DeepSeek, Gemini) are unaffected.

## [1.3.5] - 2026-10-23

### Fixed

* Fixed ChatGPT "Fold AI replies" not working after ChatGPT changed `data-chatgpt-conversation-selection-target` attribute value from `"true"` to the conversation ID. Updated `collapseOldChats()` to dynamically build the selector using the chatId from the URL, and updated CSS selectors to use attribute-presence matching.

### Changed

* Reduced folder card vertical padding from 6px to 4px for a more compact layout.

## [1.3.4] - 2026-10-23

### Changed

* Refreshed the right panel's overall look (header, body, footer): per-platform accent color, accent line under the header, square header buttons, pill-style footer buttons, an empty-state hint, and a shadow while open. CSS-only apart from a platform class on the panel; no folder/chat styling or behavior changed.

## [1.3.3] - 2026-10-23

### Added

* Added chat markers: replace the single boolean favorite flag with a numeric marker system supporting four visual badges (⭐ Favorite, 🟩 Green, 🟥 Red, 🔵 In progress). Hover the "+" action button to reveal a picker strip; click a badge before the title to clear it. Backward-compatible migration from old `fv`/`fav` fields to new `mk` field.

### Fixed

* Fixed Gemini native chat sync (delete/rename detection) not working after Gemini's frontend switched from XHR to fetch for `batchexecute` calls. Added fetch interception alongside the existing XHR patch in `gemini-main-bridge.ts`.

## [1.3.2] - 2026-10-09

### Added

* Added a Favorites feature: chats can be starred from the folder panel. A favorited chat shows a filled star before its title (click to unfavorite); an unfavorited chat shows a hover-only outline star action next to delete (click to favorite).

### Fixed

* Fixed ChatGPT "Fold AI replies" not working after a DOM restructuring that introduced a virtualized layout with subwrapper divs. Reworked to use container-level anchor + `:not(:last-child)` CSS instead of per-turn `:has(~ .anchor)` sibling selector. Updated selectors to `data-chatgpt-search-unit-key` attributes. Added conversation-change listener to remove stale anchors from cached containers.
* Fixed "Add to Folder" menu injection failing on ChatGPT after a sidebar DOM restructuring. Updated selectors: `itemSelector` to `div[role="menu"]`, `historySelector` to `#app-shell-sidebar`, `rowSelector` to `div[role="listitem"]`, and the active-chat title fallback selector to `#app-shell-sidebar a[aria-current="page"] span`. Updated the injected menu item HTML to match ChatGPT's new `data-menu-row-content` layout, preventing text wrapping.
* Fixed ChatGPT cascading menu being covered by native menu: updated `insertCascadeMenu` selector to properly insert into the current `[role="menu"]` container, ensuring correct z-index and layering of our "Add to Folder" submenu.

## [1.2.0] - 2026-08-19

### Added

* Added a first-time user guide to help new users get started with AI Chat Folders.
* Improved user documentation and reorganized the Wiki and feature documentation.

### Changed

* Optimized the local storage layout:

  * Shorter folder IDs
  * Numeric color codes
  * Byte-based name limits
  * A more compact on-disk tree structure
  * A single merged global setting (`enabled` / `syncNativeChanges`) synchronized across devices via `chrome.storage.sync`
* Improved the overall user experience and documentation.

### Fixed

* Fixed an issue where **Add To Folder** failed to work on Claude after a recent DOM update.
* Fixed the folder editor's color picker and name input overflowing the panel on Gemini and DeepSeek, caused by injected UI relying on the host page's CSS reset.

## [1.0.0] - 2026-08-08

### Added

* Create folders and subfolders to organize conversations across ChatGPT, Gemini, Claude, and DeepSeek.
* Save conversations into folders, with drag & drop support for both folders and chats.
* Native integration with each platform's sidebar, including dark mode support.
* Automatic sync of native chat renames and deletions into local folders, so folders never point to a chat that no longer exists.
* Optional toggle to hide native sidebar chats that are already saved to a folder, avoiding duplicate entries.
* Folders are kept separate per logged-in account on platforms that support multiple accounts.
* Settings page to enable or disable the extension on a per-platform basis.
* Native chat sync settings that take effect immediately on already-open tabs.
* Export and import of the entire folder structure as a JSON file, for backup or transferring between browsers.
* Available in English, Japanese, and Chinese.
* Local storage only — no account required, no analytics, no tracking, and conversations are never copied or uploaded.