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
		border-left: 1px solid #333;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		display: flex;
		flex-direction: column;
		padding: 0; /* padding 下放到 header/body/footer 各自身上 */
	}
	.aichat-panel.is-open { right: 0; }


	/* ------------------------------ */
    /* --- Header & Buttons --- */
	/* ------------------------------ */
	.aichat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 20px 10px 20px;
		border-bottom: 1px solid #333;
		flex-shrink: 0;
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
		padding: 0 20px;
		border-top: 1px solid #333;
		display: flex;
		align-items: center;
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