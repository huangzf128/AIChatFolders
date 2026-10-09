# Collapse AI Answers

## Summary

Adds a "Fold AI replies" button in the right panel footer that collapses older AI responses in the current conversation, leaving only the latest answer fully visible. This makes it much easier to scroll back through long conversations without being overwhelmed by walls of AI-generated text.

## Key Capabilities
- **One-Click Batch Fold**: Clicking the footer button instantly collapses all AI answers except the most recent one, reducing each to a compact preview (2 lines for Gemini, ~4 lines for Claude/ChatGPT).
- **Per-Answer Toggle**: After folding, clicking any collapsed answer expands it; clicking the top 40px of an expanded answer collapses it again.
- **Per-Conversation Scope**: Folding only affects the current conversation. Switching to another chat resets everything — no stale state.
- **Lazy-Load Safe**: On platforms that lazy-load older messages on scroll (Gemini, ChatGPT), newly loaded answers are automatically collapsed by CSS — no JS re-scan needed.

## Technical Implementation

### Architecture
The feature is built on a **CSS-driven, JS-minimal** design:

1. **Container Toggle (JS)**: `collapseOldChats()` adds `ai-chat-folder-anchor`
   to the conversation container. On ChatGPT, stale anchors on cached
   (non-active) containers are cleared first, and the last assistant response
   also gets `ai-chat-folder-collapsed` directly for immediate visual feedback.

2. **Batch Collapse (CSS)**: Platform-specific selectors match all AI turns
   except the last, applying collapse styles. Because the rule is pure CSS,
   any AI turn added later by infinite-scroll is automatically covered.

3. **Per-Answer Toggle (JS)**: A delegated click listener on the conversation
   container toggles `ai-chat-folder-expanded` / `ai-chat-folder-collapsed`
   on individual answers. These classes use `!important` to override the batch
   rule. A guard (`document.querySelector('.ai-chat-folder-anchor')`) ensures
   clicks are ignored when folding is not active.

### Platform Differences

| Platform | Container | Turn Selector | Response Selector | Collapse Method |
|----------|-----------|---------------|-------------------|-----------------|
| Gemini | `[data-test-id="chat-history-container"]` | `.conversation-container` | `.response-content` | `-webkit-line-clamp: 2` |
| Claude | `[data-testid="transcript-sizer"]` | `[data-perf-row="assistant"]` | `[data-perf-row="assistant"]` | `max-height: 6em` + `overflow: hidden` |
| ChatGPT | `div[data-app-shell-active-page="true"] div[data-chatgpt-conversation-selection-target="true"]` | `[data-chatgpt-search-unit-key$=":user"]` | `[data-chatgpt-search-unit-key$=":assistant"]` | `max-height: 6em` + `overflow: hidden` |

- **Gemini** uses `-webkit-line-clamp` for truncation because its response
  element supports the `-webkit-box` display model.
- **Claude and ChatGPT** both use `max-height` + `overflow: hidden` (with a
  border + border-radius on collapsed answers) — confirmed via testing that
  `section[data-turn="assistant"]` on ChatGPT also fails to render
  `-webkit-line-clamp` correctly (same underlying issue as Claude's inline
  `display: flow-root` preventing `-webkit-box` from taking effect), so both
  share `CLAUDE_COLLAPSED_BODY` in `collapse.ts` despite the constant's name.
- **ChatGPT** uses a container-level anchor (`ai-chat-folder-anchor` on the
  conversation container) with `:not(:last-child)` on subwrappers to fold all
  turns except the last. The last assistant response is also collapsed via JS
  (`ai-chat-folder-collapsed`) so the user sees immediate feedback. On
  conversation switch, anchors are removed via `aichatfolders:conversation-changed`.
- **DeepSeek** is not supported because its virtual list (`ds-virtual-list`)
  removes DOM nodes as the user scrolls, making the anchor unreliable.

### Interaction Logic
1. User clicks **"Fold AI replies"** in the footer → `collapseOldChats()` runs.
2. All AI answers before the last turn collapse; a `::after` pseudo-element
   shows "Click to show detail" in the top-right corner.
3. Clicking a collapsed answer → expands it; the hint changes to
   "Click here to hide detail".
4. Clicking the top 40px of an expanded answer → collapses it again.
5. Clicking elsewhere in an expanded answer → no effect (normal interaction).
6. Switching conversations → anchors are removed, all answers return to
   their default expanded state.

### Files Involved
- `src/adapters/LeftSidebar.ts` — base class: `collapseOldChats()`,
  `initCollapseClickListener()`, three selector properties.
- `src/adapters/GeminiAdapter.ts` — Gemini selectors + `init()` call.
- `src/adapters/ClaudeAdapter.ts` — Claude selectors + `init()` call +
  overridden `collapseOldChats()` (anchor goes on the last assistant row,
  not on the sizer).
- `src/adapters/ChatGPTAdapter.ts` — ChatGPT selectors + `init()` call +
  overridden `collapseOldChats()` (container-level anchor +
  `:not(:last-child)` CSS to fold all but the last turn; last assistant
  also collapsed via JS for immediate feedback; conversation-change listener
  removes stale anchors from cached containers).
- `src/ui/RightSidebar.ts` — footer button, click delegation to adapter.
- `src/ui/icons.ts` — `COLLAPSE_ANSWERS` SVG icon.
- `src/ui/styles/collapse.ts` — all collapse/expand CSS rules per platform.

## Known Limitations
- **DeepSeek not supported**: The virtual list removes off-screen DOM nodes,
  so the anchor class can be lost when the user scrolls.
- **No per-answer toggle button**: Currently the only way to expand/collapse
  an individual answer is by clicking its content area. A dedicated toggle
  icon at the top of each answer could improve discoverability (deferred).
- **No persistence**: Folding state is not saved — it resets when the
  conversation is switched or the page is reloaded. This is intentional.

## Revision History
| Date | Commit | Description |
|------|--------|--------------|
| 2026-09-10 | `bfa7d87` | Initial implementation: "Fold AI replies" footer button across Gemini, Claude, and ChatGPT. CSS-driven anchor + `:has()` sibling selector, per-answer click toggle. DeepSeek intentionally left unsupported (virtual list removes off-screen DOM nodes, making the anchor unreliable). Also moved the existing "Hide chats" eye toggle from the header into the footer alongside the new button, so the footer becomes the panel's dedicated action-button area going forward; updated both buttons' labels/tooltips accordingly (see `docs/features/HideChats.md` revision history). |
| 2026-10-09 | — | ChatGPT: reworked for new DOM structure (virtualized layout with subwrappers). Changed to container-level anchor + `:not(:last-child)` CSS instead of per-turn `:has(~ .anchor)` sibling selector. Selectors updated to `data-chatgpt-search-unit-key` attributes. Last assistant response also collapsed via JS for immediate feedback. Added `aichatfolders:conversation-changed` listener to remove stale anchors from cached containers on conversation switch. |

## TODO
- [ ] Consider adding a per-answer toggle icon at the top of each collapsed/expanded answer
- [ ] Re-evaluate DeepSeek support if the virtual-list behavior changes