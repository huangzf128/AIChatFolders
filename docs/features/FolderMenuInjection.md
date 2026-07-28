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

## Technical Implementation

### Architecture
- `LeftSidebarAdapter` (base class) owns all the framework-agnostic
  menu machinery: `showLevelMenu()` builds and positions the cascade
  levels, `removeCascadeMenus()` / `removeSubMenus()` tear them down,
  and `startCloseTimer()` / `clearCloseTimer()` implement the
  hover-driven grace period before an unused level auto-closes.
- Each adapter (`ChatGPTAdapter`, `ClaudeAdapter`, `DeepSeekAdapter`,
  `GeminiAdapter`) only implements the platform-specific parts:
  - `initClickListener()` — a capture-phase click listener on
    `document.body` that caches the target chat's id/title
    (`currentTargetChat`) at the moment the user opens the native
    menu, since the menu itself carries no chat-id in its own markup.
  - `createMenuItem()` — finds the native menu's content container
    (`itemSelector`) and appends a cloned-style "Add to Folder" node,
    wiring `mouseenter`/`mouseleave` to open/close the first cascade
    level via the shared `showLevelMenu()`.
  - `getChatInfo()` — resolves the final `{ id, title, url }` payload,
    preferring the cached `currentTargetChat` and falling back to
    parsing the current page's URL/DOM.
- **`closeNativeMenu()`** (new, see Revision History) is a `protected
  virtual` method on the base class that dismisses the *native*
  platform menu once a folder has been picked — distinct from
  `removeCascadeMenus()`, which only tears down our own injected
  submenu. It exists because different platforms close their native
  menus through fundamentally different mechanisms:
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
- `src/adapters/LeftSidebar.ts` — `showLevelMenu`, `removeCascadeMenus`,
  `removeSubMenus`, `startCloseTimer`/`clearCloseTimer`,
  `closeNativeMenu` (default Escape-based implementation).
- `src/adapters/ChatGPTAdapter.ts`, `ClaudeAdapter.ts`,
  `DeepSeekAdapter.ts` — `itemSelector`, `initClickListener`,
  `createMenuItem`, `getChatInfo` per platform; inherit the default
  `closeNativeMenu()`.
- `src/adapters/GeminiAdapter.ts` — same, plus a `closeNativeMenu()`
  override that clicks `.cdk-overlay-backdrop` directly.

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

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| — | — | Initial implementation (predates this document): native "Add to Folder" menu item injection and cascading folder submenu, across all four platforms. |
| 2026-07-28 | `<commit-hash>` | Fixed the native platform menu staying open after picking a folder. Added a virtual `closeNativeMenu()`; default dispatches a real `Escape` keydown on `document.body` (Radix-style platforms). Gemini overrides it to click the real `.cdk-overlay-backdrop` element instead, since its Angular CDK Overlay menu only dismisses via that physical element being the click's actual target — a synthetic event elsewhere in the document never reached it. |

## TODO
- [ ] None currently.