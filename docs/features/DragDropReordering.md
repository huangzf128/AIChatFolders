# Drag & Drop Reordering

## Summary

Lets folders and chat leaves be reordered within the tree via native HTML5
drag-and-drop — moving a node before, after, or inside another node — with
reliable behavior even on host pages whose own scripts intercept the
native `drop` event before it reaches the panel.

## Key Capabilities
- **Everything is draggable** — both folders and chat items can be dragged
  to rearrange the tree structure.
- **Placement logic** (based on cursor position over the target card):
  - **Top 20%** → place the item **before** the target.
  - **Middle 60%** → place the item **inside** the target (as a child).
  - **Bottom 20%** → place the item **after** the target.
- **Loop prevention**: dragging a parent folder into itself or its own
  descendants is blocked.
- **Visual feedback**: insertion lines and background highlights indicate
  where the item will land while dragging.
- **Cross-platform drop reliability**: reordering still works on host pages
  that swallow the native `drop` event (see `dragend` fallback below).

## Technical Implementation

### Architecture
- Implemented with the native HTML5 Drag and Drop API (`draggable="true"`,
  `dragstart` / `dragenter` / `dragover` / `drop` / `dragend`) inside
  `RightSidebar.bindDragEvents()`. This code is platform-agnostic — it
  lives in the shared UI layer, not in any adapter, since none of the drag
  mechanics depend on a specific AI platform's DOM.
- `commitMove(targetNode, movingId)` is a single shared function
  containing the entire "resolve drop position → validate → persist →
  refresh" logic. It reads all the transient DOM state it needs (the
  `.dragging` class on the source card, the `drop-inside` class and
  `data-drop-pos` attribute on the target) synchronously, at the top of
  the function, **before** calling `finalizeDrag()` to tear that state
  down. This read-before-clear ordering is load-bearing: `finalizeDrag()`
  clears exactly the classes/attributes `commitMove` depends on, so any
  future refactor must preserve it — see Revision History for what
  happens when it doesn't.
- Both the `drop` and `dragend` listeners call `commitMove` with the same
  two arguments (`currentTargetNode`, `draggedId`). A `dropHandled` flag,
  reset on every `dragstart`, ensures `dragend` only invokes `commitMove`
  when `drop` never fired for the current drag — otherwise the move would
  be committed twice.
- `FolderManager.reorder()` performs the actual tree splice (detach the
  moving node, then re-attach it before/after/inside the target) and
  unconditionally persists via `saveFolders()` once attachment completes.

### Interaction Logic (RightSidebar)
- Cursor position over the target card's vertical extent determines
  placement: top 20% → before, middle 60% → inside, bottom 20% → after.
- `dragenter` is debounced (100ms) to avoid flicker when quickly crossing
  several nodes in succession.
- A parent folder cannot be dropped into itself or any of its own
  descendants (checked via `Node.contains()` during `dragenter`).
- A chat leaf cannot be dragged outside of `#aichat-folder-list` (it would
  otherwise lose its parent folder); this is enforced inside `commitMove`,
  not at `dragenter` time.
- **`dragend` fallback for hosts that swallow `drop`**: some host pages
  (observed on DeepSeek, chat.deepseek.com) inject an overlapping
  page-level element mid-drag — e.g. their own "drop a file to upload"
  overlay — which becomes the actual `elementFromPoint` target at
  mouse-up. Because that element isn't a descendant of `this.panel`, the
  native `drop` event never bubbles to our listener, even though
  `dragenter`/`dragover` fired normally earlier in the same drag
  (confirmed via `console.log`: `drop` never printed on DeepSeek, `dragend`
  always did). Native `dragend`, unlike `drop`, always fires on the drag
  source regardless of what the actual drop target ended up being, so it
  is used as an unconditional fallback that replays the same `commitMove`
  call using the last known `currentTargetNode` / `draggedId`.

### Files Involved
- `src/ui/RightSidebar.ts` — `bindDragEvents()`, `commitMove()`,
  `finalizeDrag()`, and the `dragstart`/`dragenter`/`dragover`/`drop`/
  `dragend` listeners.
- `src/models/FolderManager.ts` — `reorder()` (tree splice + persistence).

## Known Limitations
- The `drop`-swallowing behavior is currently confirmed only on DeepSeek.
  If another platform introduces a similar overlapping overlay during
  drag, the same `dragend` fallback should cover it automatically (it
  isn't DeepSeek-specific code), but this hasn't been explicitly verified
  on other platforms.
- The `dragend` fallback re-derives drop position from the same signals
  `dragover` maintains during a normal drag (`currentTargetNode`,
  `data-drop-pos`, `drop-inside`). If `dragover` never fires at all on some
  host, the fallback has nothing to work from and the drop is silently
  ignored.

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| — | — | Initial implementation (predates this document): native HTML5 drag-and-drop reordering of the folder tree, with before/inside/after placement based on cursor position and loop prevention. |
| 2026-08-02 | `<commit-hash>` | Added a `dragend`-based fallback so drag-and-drop reordering still works on host pages (e.g. DeepSeek) that swallow the native `drop` event before it reaches the panel; extracted the shared `commitMove()` so `drop` and `dragend` invoke identical logic. Fixed a regression introduced during that refactor where `commitMove` read `drop-inside`/`data-drop-pos`/`.dragging` state *after* `finalizeDrag()` had already cleared it, which made every drop resolve to the same wrong position on every platform, not just DeepSeek. Fixed a `FolderManager.reorder()` regression where an `if (!attached)` guard around `saveFolders()` accidentally skipped persistence on the normal, successful-attach path. |

## TODO
- [ ] None currently.
