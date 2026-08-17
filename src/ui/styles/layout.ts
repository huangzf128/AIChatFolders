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


	/* ------------------------------ */
	/* --- Platform-specific Dock Colors --- */
	/* ------------------------------ */

	/* ChatGPT: Classic OpenAI green */
	.aichat-dock-trigger.aichat-dock-chatgpt {
		background-color: #10a37f;
	}
	.aichat-dock-trigger.aichat-dock-chatgpt:hover {
		background-color: #1a7f64;
	}

	/* Claude: Terracotta / Clay orange */
	.aichat-dock-trigger.aichat-dock-claude {
		background-color: #da7756;
	}
	.aichat-dock-trigger.aichat-dock-claude:hover {
		background-color: #c2653f;
	}

	/* DeepSeek: Deep blue */
	.aichat-dock-trigger.aichat-dock-deepseek {
		background-color: #2d63e0;
	}
	.aichat-dock-trigger.aichat-dock-deepseek:hover {
		background-color: #2d63e0;
	}

	/* Gemini: Four-color gradient (Google brand colors) */
	.aichat-dock-trigger.aichat-dock-gemini {
		background: linear-gradient(180deg, #ea4335 0%, #fbbc05 33%, #4285f4 66%, #34a853 100%);
	}
	.aichat-dock-trigger.aichat-dock-gemini:hover {
		filter: brightness(1.15);
	}	
`;