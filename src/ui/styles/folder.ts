/**
 * Folder
 */
export const FolderStyles = `
	/* ------------------------------ */
    /* --- Folder Cards --- */
	/* ------------------------------ */
    .aichat-folder-card {
        background: #212121;
        border-radius: 8px;
        padding: 6px 12px;
        margin-bottom: 0;
        border: 1px solid #333;
        transition: all 0.2s ease;
        cursor: grab;
        position: relative;
    }
    .aichat-folder-card:hover { background: #2a2a2a; }
    .aichat-folder-card:active { cursor: grabbing; }

    .aichat-folder-header {
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        color: #efefef; 
        font-size: 14px; 
        font-weight: 500;
    }

    .aichat-folder-title {
        display: flex;
        align-items: center;
        gap: 10px; /* Increased gap for better breathing room */
        color: #efefef;
    }

	/* ----------------------------------- */
	/* --- Folder Icon with Color Glow --- */
	/* ----------------------------------- */

	.aichat-folder-icon {
        display: flex;
        align-items: center;
        color: #888;
        transition: all 0.2s ease;
    }

    .aichat-folder-icon.colored {
        filter: drop-shadow(0 0 2px var(--glow-color)) 
                drop-shadow(0 0 6px var(--glow-color));
        color: #bebebe; 
    }

	/* ✅ Open state: remove glow, brighten color */
	.aichat-folder-node:not(.is-collapsed) > .aichat-folder-card .aichat-folder-icon.colored {
		filter: none;
		color: var(--glow-color);
	}


	.aichat-folder-node {
		position: relative;
		padding: 4px 0;
		transition: all 0.2s ease;
	}
	
	/* Vertical dotted line connecting subfolders for visual guidance */
    .aichat-sub-container {
        border-left: 1px dashed var(--glow-color);
        margin-left: 8px;
        padding-left: 10px;
    }

	/* Folder icon as clickable toggle */
	.aichat-folder-icon.toggle-folder {
		cursor: pointer;
		transition: transform 0.2s ease;
	}

	.aichat-folder-icon.toggle-folder:hover {
		transform: scale(1.1);
	}	

	/* ----------------------------------- */
    /* --- Folder Actions (Plus/Trash) --- */
	/* ----------------------------------- */
    .aichat-actions {
		display: flex;
		gap: 8px;
    }
    .aichat-actions span {
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease;
        display: flex;
        align-items: center;
    }
	
	.aichat-folder-card:hover .aichat-actions span {
		opacity: 0.5;
	}

	/* Hover effect: Scale up and become fully opaque */
	.aichat-actions span:hover {
		opacity: 1 !important;
		transform: scale(1.1); /* Slightly enlarge for better tactility */
	}

    .aichat-actions .delete-btn { color: #ff4d4f; }
	.aichat-actions .delete-btn:hover {
		filter: brightness(1.2);
		text-shadow: 0 0 8px rgba(255, 77, 79, 0.3);
	}	
    .aichat-actions .add-sub-btn { color: #10a37f; }
	.aichat-actions .add-sub-btn:hover {
		filter: brightness(1.2);
		text-shadow: 0 0 8px rgba(16, 163, 127, 0.3);
	}
	.aichat-actions .edit-btn {color: #e9ad08;}
	.aichat-actions .edit-btn:hover {
		filter: brightness(1.2);
		text-shadow: 0 0 8px rgba(233, 173, 8, 0.3);
	}

	/* ---------------------------- */
    /* --- Drag and Drop States --- */
	/* ---------------------------- */
    .aichat-folder-card.dragging {
        opacity: 0.4;
        border: 1px dashed #777;
    }
    
	.aichat-folder-node.has-drop-before {
		padding-top: 50px; /* Space for the placeholder */
	}

	.aichat-folder-node.has-drop-before::before {
		content: "Insert Above";
		display: flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 36px;
		border: 2px dashed #444;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.02);
		color: #666;
		font-size: 11px;
		pointer-events: none;
	}

	/* Inside State: Added via DragOver */
	.aichat-folder-card.drop-inside {
		background: rgba(16, 163, 127, 0.25) !important;
		outline: 2px solid #10a37f;
	}

	/* 💡 "Placeholder after the last node" */
	.aichat-folder-node[data-drop-pos="after"] {
		position: relative;
		padding-bottom: 50px; /* Spacer height roughly equal to one card */
	}

	.aichat-folder-node[data-drop-pos="after"]::after {
		content: "Drop here to end";
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 36px;
		border: 2px dashed rgba(255, 255, 255, 0.2); /* Dashed border */
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.4);
		font-size: 12px;
		pointer-events: none; /* Required to prevent mouse interference */
		margin-top: 8px;
	}

	/* 1. Base button style (in the right action bar) */
	.toggle-btn {
		display: inline-flex;
		cursor: pointer;
		transition: transform 0.3s ease; /* 💡 Rotate animation */
	}

	/* 2. Default expanded state: arrow points down (rotate 0deg) */
	.toggle-btn svg {
		transform: rotate(0deg);
	}

	/* 3. 💡 Collapsed state: rotate arrow 180deg pointing up, indicating "closed" */
	.is-collapsed .toggle-btn svg {
		transform: rotate(180deg); 
	}

	/* 4. 💡 Collapsed state: hide the sub-folder container */
	.is-collapsed .aichat-sub-container {
		display: none;
	}

	.aichat-cascade-menu {
		position: fixed; /* Use fixed to completely eliminate parent positioning interference */
		background: #2f2f2f;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0,0,0,0.4);
		z-index: 100000; /* Ensure it appears above Gemini/ChatGPT menus */
		padding: 4px 0;
		min-width: 180px;
	}

	/* Individual Item */
	.aichat-cascade-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		color: #e3e3e3;
		font-size: 14px;
		cursor: pointer;
		transition: background 0.2s;
		position: relative;
		margin-left: -2px;
	}

	.aichat-cascade-item:hover {
		background-color: rgba(255, 255, 255, 0.08);
	}

	/* Sub-menu styling */
	.aichat-sub-menu {
		display: none;
		position: absolute;
		left: 100%; /* Show to the right */
		top: -8px;
		padding: 8px 0;
	}

	.aichat-cascade-item:hover > .aichat-sub-menu {
		display: block;
	}


	/* ------------------------------ */
	/* --- Chat Leaf Nodes (Records) -- */
	/* ------------------------------ */
	
	/* ── Chat Leaf Nodes (Records) ── */

	/* Chat leaf card: ultra compact, background blends with parent */
	.aichat-chat-leaf .aichat-folder-card {
		background: transparent;
		border-radius: 0;
		padding: 1px 2px;
		min-height: 0;
		border: none;
		// border-left: 2px solid #333;
		margin: 0;
		transition: background 0.1s ease;
	}

	.aichat-chat-leaf .aichat-folder-card:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	/* Chat title: compact, readable */
	.aichat-chat-leaf .aichat-folder-title {
		font-size: 13x;
		font-weight: 400;
		color: #e9e9e9;          /* Brighter for readability */
		gap: 0;
		min-width: 0;
		overflow: hidden;
	}

	/* Chat anchor link: ellipsis with tooltip on hover */
	.aichat-chat-anchor {
		color: #e9e9e9;
		text-decoration: none;
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 2px 0;
	}

	.aichat-chat-anchor:hover {
		color: #ffffff;
		text-decoration: none;
	}

	/* Hide folder icon for chat leaves */
	.aichat-chat-leaf .aichat-folder-icon {
		display: none;
	}

	/* Delete button: hidden by default, visible on row hover */
	.aichat-chat-leaf .delete-btn {
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.aichat-chat-leaf:hover .delete-btn {
		opacity: 0.3;
	}

	.aichat-chat-leaf .delete-btn:hover {
		opacity: 1;
	}

	/* Remove extra spacing between chat items */
	.aichat-chat-leaf {
		padding: 0;
		margin: 0;
	}

	/* Remove left border for sub-containers inside chat leaves */
	.aichat-chat-leaf .aichat-sub-container {
		border-left: none;
		padding-left: 0;
	}

	/* ------------------------------ */
	/* --- Newly Added Highlight   --- */
	/* ------------------------------ */
	@keyframes aichat-flash-highlight {
		0%, 100% { background: transparent; box-shadow: none; }
		50% { background: rgba(16, 163, 127, 0.35); box-shadow: 0 0 0 1px rgba(16, 163, 127, 0.6); }
	}
	.aichat-just-added {
		animation: aichat-flash-highlight 1.5s ease-in-out 3;
	}

`;