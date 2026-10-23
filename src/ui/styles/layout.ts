/**
 * Main Layout Components
 */
export const LayoutStyles = `

    /* Explicit box-sizing reset scoped to our own injected UI, so we never
       depend on the host page's global CSS reset (e.g. Tailwind preflight
       on ChatGPT/Claude) to render correctly. Without this, platforms that
       don't ship such a reset (Gemini, DeepSeek) fall back to the browser's
       default content-box, which silently inflates bordered/padded elements
       beyond their intended size. */
    .aichat-panel, .aichat-panel *, .aichat-panel *::before, .aichat-panel *::after,
    .aichat-cascade-menu, .aichat-cascade-menu *, .aichat-cascade-menu *::before, .aichat-cascade-menu *::after,
    .aichat-confirm-overlay, .aichat-confirm-overlay *, .aichat-confirm-overlay *::before, .aichat-confirm-overlay *::after,
    .aichat-dock-trigger {
        box-sizing: border-box;
    }

	.aichat-panel {
		position: fixed;
		right: -320px;
		top: 0;
		width: 320px;
		height: 100%;
		background-color: #171717;
		z-index: 10001;
		transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-sizing: border-box;
		border-left: 1px solid #2c2c2c;
		background-image: linear-gradient(180deg, #1b1b1b 0%, #171717 40%);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		display: flex;
		flex-direction: column;
		padding: 0; /* padding 下放到 header/body/footer 各自身上 */
	}
	/* Shadow only while open, so it never leaks onto the screen edge when the panel is parked off-screen */
	.aichat-panel.is-open {
		right: 0;
		box-shadow: -12px 0 32px rgba(0, 0, 0, 0.35);
	}

	/* Accent color per platform (mirrors the dock trigger colors) */
	.aichat-panel {
		--aichat-accent: #10a37f;
		--aichat-accent-soft: rgba(16, 163, 127, 0.15);
	}
	.aichat-panel-claude   { --aichat-accent: #da7756; --aichat-accent-soft: rgba(218, 119, 86, 0.15); }
	.aichat-panel-deepseek { --aichat-accent: #4d6bfe; --aichat-accent-soft: rgba(77, 107, 254, 0.15); }
	.aichat-panel-gemini   { --aichat-accent: #4285f4; --aichat-accent-soft: rgba(66, 133, 244, 0.15); }


	/* ------------------------------ */
    /* --- Header & Buttons --- */
	/* ------------------------------ */
	.aichat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 16px 14px 20px;
		border-bottom: 1px solid #2a2a2a;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
		flex-shrink: 0;
		position: relative;
	}
	/* Thin accent line under the header, fading out to the right */
	.aichat-header::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: -1px;
		width: 100%;
		height: 2px;
		background: linear-gradient(90deg, var(--aichat-accent), transparent 70%);
		opacity: 0.8;
		pointer-events: none;
	}
	.aichat-title {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		color: #f2f2f2;
		font-size: 17px;
		font-weight: 600;
		letter-spacing: 0.2px;
	}
	.aichat-title::before {
		content: '';
		width: 4px;
		height: 18px;
		border-radius: 2px;
		background: var(--aichat-accent);
	}
	/* Header icon buttons: fixed square hit area instead of text-like padding */
	.aichat-header .aichat-header-btn {
		width: 34px;
		height: 34px;
		padding: 0;
		justify-content: center;
		border-radius: 8px;
	}
	.aichat-header .aichat-header-btn:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	
    .aichat-header-btn {
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
        font-size: 18px;
        color: #888;
        display: flex;
        align-items: center;
    }
    .aichat-header-btn:hover {
        background: #333;
        color: #fff;
    }

    .aichat-help-link {
        color: rgba(255, 255, 255, 0.35);
        text-decoration: none;
        vertical-align: middle;
        margin-left: 4px;
        display: inline-flex;
        align-items: center;
        transition: color 0.2s;
    }
    .aichat-help-link:hover {
        color: rgba(255, 255, 255, 0.85);
    }

	/* ------------------------------ */
	/* --- Scrollable Body Region --- */
	/* ------------------------------ */
	.aichat-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 16px 20px 20px 20px;
	}

	/* Empty state: pure CSS, matches only while the list has no rendered nodes */
	#aichat-folder-list:empty::before {
		content: 'No folders yet.\A Click the folder icon at the top to create one.';
		display: block;
		white-space: pre-line;
		text-align: center;
		margin: 48px 12px 0;
		padding: 24px 12px;
		border: 1px dashed #333;
		border-radius: 12px;
		color: #777;
		font-size: 13px;
		line-height: 1.7;
	}

	.aichat-body::-webkit-scrollbar { width: 6px; }
	.aichat-body::-webkit-scrollbar-track { background: transparent; }
	.aichat-body::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 3px;
	}
	.aichat-body::-webkit-scrollbar-thumb:hover { background: #555; }

	/* ------------------------------ */
	/* --- Footer (reserved) --- */
	/* ------------------------------ */
	.aichat-footer {
		flex-shrink: 0;
		height: 60px;
		padding: 0 16px;
		border-top: 1px solid #2a2a2a;
		background: #141414;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	/* Footer actions as equal-width pill buttons */
	.aichat-footer .aichat-header-btn {
		flex: 1 1 0;
		min-width: 0;
		justify-content: center;
		padding: 8px 10px;
		white-space: nowrap;
		color: #a8a8a8;
		background: #1e1e1e;
		border: 1px solid #2e2e2e;
		border-radius: 8px;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}
	.aichat-footer .aichat-header-btn:hover {
		background: #2a2a2a;
		border-color: #3d3d3d;
		color: #fff;
	}
	/* Three classes: must beat both the hover rule above and components.ts's .is-active */
	.aichat-footer .aichat-header-btn.is-active {
		color: var(--aichat-accent);
		background: var(--aichat-accent-soft);
		border-color: var(--aichat-accent);
	}
	
	/* ------------------------------ */
    /* ---        dock        --- */
	/* ------------------------------ */
    .aichat-dock-trigger {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 10px;
        height: 60px;
        background-color: #10a37f;
        cursor: pointer;
        z-index: 10000;
        border-radius: 10px 0 0 10px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: -2px 0 8px rgba(0,0,0,0.2);
    }

    .aichat-dock-trigger:hover {
        width: 20px;
        background-color: #1a7f64;
    }

    .aichat-dock-trigger.is-hidden {
        right: -30px;
        opacity: 0;
        pointer-events: none;
    }

    /* One-shot onboarding hint: draws attention to the dock trigger for
       first-time users who might not notice the thin edge tab. Purely
       visual — no state, driven entirely by class add/remove in
       RightSidebar.maybeShowDockHint(). Uses a single-pulse keyframe
       played 8 times (iteration-count) instead of encoding every pulse
       in the keyframe — much cleaner and all pulses are identical. */
    @keyframes aichat-dock-hint-pulse {
        0%, 70%, 100% {
            transform: translateY(-50%);
            width: 10px;
            box-shadow: -2px 0 8px rgba(0,0,0,0.2);
        }
        30%, 50% {
            transform: translateY(-50%);
            width: 40px;
            box-shadow: -6px 0 28px var(--dock-glow, rgba(16,163,127,0.7));
        }
    }
    .aichat-dock-trigger.aichat-dock-hint {
        animation: aichat-dock-hint-pulse 1.2s ease-in-out 5;
        animation-delay: 1s;
    }

    /* Laser beams shooting up/down from the dock, synchronized with the
       width expansion pulses. Uses ::before (up) and ::after (down) so
       no extra DOM elements are needed. Same single-pulse × 8 pattern. */
    .aichat-dock-trigger.aichat-dock-hint::before,
    .aichat-dock-trigger.aichat-dock-hint::after {
        content: '';
        position: absolute;
        right: 0;
        width: 8px;
        height: 0;
        border-radius: 4px;
        pointer-events: none;
        animation: aichat-dock-laser-pulse 1.2s ease-in-out 5;
        animation-delay: 1s;
    }
    .aichat-dock-trigger.aichat-dock-hint::before {
        bottom: 100%;
        background: linear-gradient(to top, var(--dock-laser, #10a37f), transparent);
        box-shadow: 0 -8px 18px var(--dock-glow, rgba(16,163,127,0.7)),
                    0 -8px 36px var(--dock-glow, rgba(16,163,127,0.35));
    }
    .aichat-dock-trigger.aichat-dock-hint::after {
        top: 100%;
        background: linear-gradient(to bottom, var(--dock-laser, #10a37f), transparent);
        box-shadow: 0 8px 18px var(--dock-glow, rgba(16,163,127,0.7)),
                    0 8px 36px var(--dock-glow, rgba(16,163,127,0.35));
    }
    @keyframes aichat-dock-laser-pulse {
        0%, 15%   { height: 0;    opacity: 0; }
        30%       { height: 320px; opacity: 1; }
        50%       { height: 320px; opacity: 0.7; }
        70%       { height: 0;    opacity: 0; }
        100%      { height: 0;    opacity: 0; }
    }


	/* ------------------------------ */
	/* --- Platform-specific Dock Colors --- */
	/* ------------------------------ */

	/* ChatGPT: Classic OpenAI green */
	.aichat-dock-trigger.aichat-dock-chatgpt {
		background-color: #10a37f;
		--dock-glow: rgba(16,163,127,0.6);
		--dock-laser: #10a37f;
	}
	.aichat-dock-trigger.aichat-dock-chatgpt:hover {
		background-color: #1a7f64;
	}

	/* Claude: Terracotta / Clay orange */
	.aichat-dock-trigger.aichat-dock-claude {
		background-color: #da7756;
		--dock-glow: rgba(218,119,86,0.6);
		--dock-laser: #da7756;
	}
	.aichat-dock-trigger.aichat-dock-claude:hover {
		background-color: #c2653f;
	}

	/* DeepSeek: Deep blue */
	.aichat-dock-trigger.aichat-dock-deepseek {
		background-color: #2d63e0;
		--dock-glow: rgba(45,99,224,0.6);
		--dock-laser: #2d63e0;
	}
	.aichat-dock-trigger.aichat-dock-deepseek:hover {
		background-color: #2d63e0;
	}

	/* Gemini: Four-color gradient (Google brand colors) */
	.aichat-dock-trigger.aichat-dock-gemini {
		background: linear-gradient(180deg, #ea4335 0%, #fbbc05 33%, #4285f4 66%, #34a853 100%);
		--dock-glow: rgba(66,133,244,0.6);
		--dock-laser: #4285f4;
	}
	.aichat-dock-trigger.aichat-dock-gemini:hover {
		filter: brightness(1.15);
	}	
`;