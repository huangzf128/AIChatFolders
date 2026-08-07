# Native Menu Injection (Add to Folder)

## Summary

Injects an "Add to Folder" entry into each platform's native chat
context/dropdown menu (the "..." menu on a sidebar chat row), which
opens a custom cascading submenu mirroring the user's folder tree so a
chat can be filed into any folder — including nested ones — without
leaving the native menu.

## Key Capabilities
- **In-place folder picker**: no separate dialog; the submenu is
  anchored right next to the native menu item that opens it.
- **Arbitrary nesting depth**: hovering a folder that has subfolders
  opens the next cascade level to its right, same as a native OS
  context menu.
- **Consistent look per platform**: the injected menu item clones an
  existing native menu item's classes, so it inherits the host site's
  own dark/light theme and spacing instead of looking like a foreign
  element.
- **Clean handoff back to the native UI**: picking a folder saves the
  chat and closes both our cascade menu and the native menu it's
  anchored inside, leaving no leftover open menu behind.
- **Resolves the target chat even in alternate native layouts**: some
  platforms surface chat rows outside the usual sidebar shape (e.g.
  Claude's expanded "Show more" history table); a per-adapter fallback
  hook lets those still resolve the correct chat instead of silently
  failing to inject the menu item.

## Technical Implementation

### Architecture
- `LeftSidebarAdapter` (base class) owns all the framework-agnostic
  menu machinery: `showLevelMenu()` builds and positions the cascade
  levels, `removeCascadeMenus()` / `removeSubMenus()` tear them down,
  and `startCloseTimer()` / `clearCloseTimer()` implement the
  hover-driven grace period before an unused level auto-closes.
- **`initClickListener()`** (base class) is a capture-phase click
  listener on `document.body`, shared by all platforms, that resolves
  and caches the clicked chat's id/title (`currentTargetChat`) at the
  moment the user opens the native menu, since the menu itself carries
  no chat-id in its own markup. Resolution happens in two stages:
  1. **Primary**: `target.closest(historySelector)` →
     `target.closest(rowSelector)` → `extractChatIdFromRow()` — the
     normal sidebar-row shape shared by all four platforms.
  2. **Fallback**: if the primary lookup finds no chat id (the click
     didn't originate from within the regular sidebar at all),
     `resolveFallbackTargetChat(target)` is tried — a `protected
     virtual` hook, default no-op, that lets a platform recognize an
     alternate native DOM shape carrying chat rows elsewhere on the
     page. See "Per-platform fallback" below.
- Each adapter (`ChatGPTAdapter`, `ClaudeAdapter`, `DeepSeekAdapter`,
  `GeminiAdapter`) implements the remaining platform-specific parts:
  - `createMenuItem()` — finds the native menu's content container
    (`itemSelector`) and appends a cloned-style "Add to Folder" node,
    wiring `mouseenter`/`mouseleave` to open/close the first cascade
    level via the shared `showLevelMenu()`.
  - `getChatInfo()` — resolves the final `{ id, title, url }` payload,
    preferring the cached `currentTargetChat` and falling back to
    parsing the current page's URL/DOM.
- **`closeNativeMenu()`** is a `protected virtual` method on the base
  class that dismisses the *native* platform menu once a folder has
  been picked — distinct from `removeCascadeMenus()`, which only tears
  down our own injected submenu. It exists because different platforms
  close their native menus through fundamentally different mechanisms:
  - **Default (ChatGPT / Claude / DeepSeek)**: these use Radix-style
    dropdown menus, which dismiss via a document-level "was this
    interaction outside the menu" check. The base implementation
    dispatches a real `Escape` `keydown` on `document.body` to trigger
    that check. It targets `document.body` specifically (not
    `document`) — an event's propagation path only includes the
    target's *ancestors*, and `body` is a descendant of `document`, so
    dispatching on `document` would never reach a listener bound to
    `document.body`.
  - **Gemini override**: Gemini's menu is an Angular Material / CDK
    Overlay, injected into a shared `div.cdk-overlay-container`.
    Unlike the Radix pattern, CDK dismisses the overlay via a real,
    physical `.cdk-overlay-backdrop` element that sits on top of the
    page and must literally *be* the click's target (via the
    browser's normal hit-testing) — a synthetic event dispatched
    elsewhere in the document never reaches it. `GeminiAdapter`
    overrides `closeNativeMenu()` to call `.click()` directly on that
    backdrop element, letting Angular run its own real detach cycle
    (unsubscribing the overlay's internal observables, releasing the
    scroll lock, restoring `aria-hidden` on background content, and
    resetting `MatMenuTrigger`'s internal open state) — all things a
    manual `cdk-overlay-container.innerHTML = ''` would skip, silently
    corrupting Angular's internal state for that menu instance.

### Per-platform fallback
- **ClaudeAdapter**: Claude's "Show more" expanded history view
  replaces the main chat panel with a `<table data-cds="DataTable">`
  listing recent chats, structurally unrelated to the sidebar — the
  primary `historySelector`/`rowSelector` lookup never matches a click
  there. `resolveFallbackTargetChat()` is overridden to:
  1. Match the click against a row via
     `#main-content table[data-cds="DataTable"] tr`.
  2. Extract the chat id from that row's `a[href*="/chat/"]`, same as
     the normal path (`cleanChatId()` on the last href segment).
  3. Resolve the title from `row.querySelector('span.truncate')` —
     **not** from the link element. Unlike sidebar rows, this table's
     title text isn't inside the anchor at all; it lives in a sibling
     `<span class="contents">` next to it, with the actual truncated
     title in a nested `span.truncate`. Reusing `getRowTitle(linkEl)`
     here would look in the wrong subtree and silently fall back to
     `document.title`.
  - Other three platforms don't override this hook and are unaffected.

### Interaction Logic
- Hovering the injected "Add to Folder" item opens level 0 of the
  cascade, anchored to the item's bounding rect.
- Hovering a folder row with children opens the next level to its
  right; hovering a sibling folder (or one without children) tears
  down any deeper levels via `removeSubMenus()`.
- Moving the mouse off the whole cascade starts a short close-delay
  timer (`startCloseTimer`), cancelled if the mouse re-enters any
  level (`clearCloseTimer`), so briefly crossing a gap between levels
  doesn't collapse the menu.
- Clicking a folder row: saves the chat to that folder
  (`aichat:save-to-folder` custom event), removes our cascade menu,
  and calls `closeNativeMenu()` to close the native menu too.

### Files Involved
- `src/adapters/LeftSidebar.ts` — `initClickListener`,
  `resolveFallbackTargetChat` (default no-op), `showLevelMenu`,
  `removeCascadeMenus`, `removeSubMenus`,
  `startCloseTimer`/`clearCloseTimer`, `closeNativeMenu` (default
  Escape-based implementation).
- `src/adapters/ChatGPTAdapter.ts`, `DeepSeekAdapter.ts` —
  `itemSelector`, `createMenuItem`, `getChatInfo` per platform; inherit
  the default `closeNativeMenu()` and `resolveFallbackTargetChat()`.
- `src/adapters/ClaudeAdapter.ts` — same, plus a
  `resolveFallbackTargetChat()` override for the expanded history
  table; inherits the default `closeNativeMenu()`.
- `src/adapters/GeminiAdapter.ts` — same as ChatGPT/DeepSeek, plus a
  `closeNativeMenu()` override that clicks `.cdk-overlay-backdrop`
  directly.

## Known Limitations
- `closeNativeMenu()`'s default (Escape-based) path assumes the native
  menu treats a synthetic `Escape` keydown the same as a real one. If a
  platform's menu library explicitly checks `event.isTrusted` (some do,
  for security reasons), the default path would silently no-op for it —
  same as any other platform whose native menu turns out to need its
  own override, this would need a dedicated `closeNativeMenu()` override,
  the way Gemini has one.
- If Gemini ever migrates its menu off CDK Overlay (e.g. onto the
  native HTML Popover API), the `.cdk-overlay-backdrop` selector would
  stop matching and `closeNativeMenu()` would silently fall through to
  the base Escape behavior, which may or may not close it.
- Claude's `resolveFallbackTargetChat()` is keyed to the current
  `#main-content table[data-cds="DataTable"]` markup of the expanded
  "Show more" view. If Claude changes that view's structure again, the
  fallback would silently stop matching and "Add to Folder" would once
  more fail to inject there — the same class of risk the primary
  sidebar lookup already has, just for a second DOM shape.

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| — | — | Initial implementation (predates this document): native "Add to Folder" menu item injection and cascading folder submenu, across all four platforms. |
| 2026-07-28 | `<commit-hash>` | Fixed the native platform menu staying open after picking a folder. Added a virtual `closeNativeMenu()`; default dispatches a real `Escape` keydown on `document.body` (Radix-style platforms). Gemini overrides it to click the real `.cdk-overlay-backdrop` element instead, since its Angular CDK Overlay menu only dismisses via that physical element being the click's actual target — a synthetic event elsewhere in the document never reached it. |
| 2026-08-07 | `<commit-hash>` | Fixed "Add to Folder" failing to inject in Claude's expanded "Show more" history table. Moved `initClickListener()`'s chat-id resolution to a two-stage lookup: primary sidebar-shape lookup, then a new `protected virtual resolveFallbackTargetChat()` hook (default no-op) for platforms with an alternate native DOM shape. ClaudeAdapter overrides it to recognize the `<table data-cds="DataTable">` rows in that view and pull the title from a sibling `span.truncate` rather than the anchor itself. |

## TODO
- [ ] None currently.