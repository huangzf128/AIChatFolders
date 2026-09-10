/**
 * Collapse AI Answers
 *
 * Default state comes purely from CSS relationships — no JS re-scanning is
 * needed as new turns render:
 *   - `<turn>:has(~ .ai-chat-folder-anchor)` matches every turn BEFORE the
 *     anchor (older history, including anything infinite scroll loads in
 *     above it later).
 *   - `<turn>.ai-chat-folder-anchor` matches the anchor's OWN turn directly,
 *     so "collapse" also folds the very last message at the moment the
 *     button was clicked, not just everything strictly before it. Only
 *     turns added AFTER the click (genuinely new messages) are left alone.
 *
 * Two different CSS truncation strategies:
 *   - Gemini: -webkit-line-clamp clips at a full line boundary with a
 *     native ellipsis — works because Gemini's .response-content has no
 *     conflicting display style.
 *   - Claude: max-height + overflow:hidden — Claude's assistant rows
 *     carry an inline display:flow-root that prevents -webkit-box from
 *     taking effect, so line-clamp is unusable. max-height is less
 *     precise (may clip mid-line) but works reliably.
 *
 * A small "Click to show detail" badge is layered on top via ::after so the
 * affordance is explicit, not just an implied cursor:pointer.
 *
 * Explicit per-turn overrides (`.ai-chat-folder-expanded` /
 * `.ai-chat-folder-collapsed`, toggled by
 * LeftSidebarAdapter.initCollapseClickListener()) use !important
 * deliberately: the default rule's selector specificity is higher than a
 * plain two-class override, so without !important a user's explicit click
 * would be silently overridden by the bulk default rule.
 */

const GEMINI_COLLAPSED_BODY = `
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    cursor: pointer;
    position: relative;
`;

const CLAUDE_COLLAPSED_BODY = `
    max-height: 6em;
    overflow: hidden;
    cursor: pointer;
    position: relative;
    border: 1px solid var(--aichat-collapse-border, rgba(128, 128, 128, 0.25));
    border-radius: 6px;
`;

const HINT_BADGE_BODY = `
    content: 'Click to show detail';
    position: absolute;
    right: 4px;
    top: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--aichat-hint-color, #8a8a8a);
    background: var(--aichat-hint-bg, rgba(128, 128, 128, 0.15));
    padding: 1px 8px;
    border-radius: 8px;
    pointer-events: none;
    white-space: nowrap;
`;

const HINT_BADGE_EXPANDED = `
    content: 'Click here to hide detail';
    position: absolute;
    right: 4px;
    top: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--aichat-hint-color, #8a8a8a);
    background: var(--aichat-hint-bg, rgba(128, 128, 128, 0.15));
    padding: 1px 8px;
    border-radius: 8px;
    pointer-events: none;
    white-space: nowrap;
`;

export const CollapseStyles = `
    /* ── Gemini ──────────────────────────────────────────────────────── */
    .conversation-container:has(~ .ai-chat-folder-anchor) .response-content,
    .conversation-container.ai-chat-folder-anchor .response-content {
        ${GEMINI_COLLAPSED_BODY}
    }
    .conversation-container:has(~ .ai-chat-folder-anchor) .response-content::after,
    .conversation-container.ai-chat-folder-anchor .response-content::after {
        ${HINT_BADGE_BODY}
    }

    /* ── ChatGPT ─────────────────────────────────────────────────────── */
    div[data-turn-id-container]:has(~ .ai-chat-folder-anchor) section[data-turn="assistant"],
    div[data-turn-id-container].ai-chat-folder-anchor section[data-turn="assistant"] {
        ${CLAUDE_COLLAPSED_BODY}
    }
    div[data-turn-id-container]:has(~ .ai-chat-folder-anchor) section[data-turn="assistant"]::after,
    div[data-turn-id-container].ai-chat-folder-anchor section[data-turn="assistant"]::after {
        ${HINT_BADGE_BODY}
    }

    /* ── Claude ──────────────────────────────────────────────────────── */
    /* Anchor sits on the last [data-perf-row="assistant"] row; all
       earlier assistant rows (siblings) are collapsed via :has(~). */
    [data-perf-row="assistant"]:has(~ [data-perf-row="assistant"].ai-chat-folder-anchor),
    [data-perf-row="assistant"].ai-chat-folder-anchor {
        ${CLAUDE_COLLAPSED_BODY}
    }
    [data-perf-row="assistant"]:has(~ [data-perf-row="assistant"].ai-chat-folder-anchor)::after,
    [data-perf-row="assistant"].ai-chat-folder-anchor::after {
        ${HINT_BADGE_BODY}
    }

    /* ── Explicit per-turn overrides ─────────────────────────────────── */
    .ai-chat-folder-collapsed {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        max-height: 6em;
        overflow: hidden;
        cursor: pointer;
        position: relative;
        border: 1px solid var(--aichat-collapse-border, rgba(128, 128, 128, 0.25));
        border-radius: 6px;
    }
    .ai-chat-folder-collapsed::after {
        ${HINT_BADGE_BODY}
    }

    .ai-chat-folder-expanded {
        display: block !important;
        max-height: none !important;
        overflow: visible !important;
        cursor: default !important;
    }
    .ai-chat-folder-expanded::after {
        ${HINT_BADGE_EXPANDED}
    }
`;