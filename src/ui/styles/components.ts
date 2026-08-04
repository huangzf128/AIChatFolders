export const ComponentStyles = `
    .aichat-edit-card {
        background: #2a2a2a;
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 15px;
        border: 1px dashed #555;
    }
    .aichat-input {
        width: 100%;
        background: #171717;
        border: 1px solid #444;
        color: #fff;
        padding: 8px;
        border-radius: 6px;
        margin-bottom: 12px;
        outline: none;
    }

    .aichat-input:focus { border-color: #10a37f; }
    .aichat-color-picker {
        display: flex;
        gap: 8px;
        margin-bottom: 15px;
        flex-wrap: wrap;
    }
    .aichat-color-option {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;
        transition: transform 0.2s;
    }
    .aichat-color-option:hover { transform: scale(1.2); }
    .aichat-color-option.active { border-color: #fff; transform: scale(1.2); }

    .aichat-btn-group {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
    .aichat-btn {
        padding: 5px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        border: none;
        font-weight: 500;
    }
    .btn-save { background: #10a37f; color: white; }
    .btn-save:hover { background: #1a7f64; }
    .btn-cancel { background: #444; color: #ccc; }
    .btn-cancel:hover { background: #555; }  

	.aichat-native-hidden {
		display: none !important;
	}
	.aichat-header-btn.is-active {
		color: #10a37f;
		background: rgba(16, 163, 127, 0.15);
	}	

	.aichat-confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100001; /* above .aichat-cascade-menu (100000) so it always wins */
	}
	.aichat-confirm-title {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #10a37f;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		margin-bottom: 10px;
		padding-bottom: 10px;
		border-bottom: 1px solid #3a3a3a;
	}

	.aichat-confirm-chatgpt .aichat-confirm-title { color: #10a37f; }
	.aichat-confirm-claude .aichat-confirm-title { color: #d97757; }
	.aichat-confirm-deepseek .aichat-confirm-title { color: #4d6bfe; }
	.aichat-confirm-gemini .aichat-confirm-title { 
		background: linear-gradient(10deg, #4285f4 20%, #34a853 35%, #fbbc05 70%, #ea4335 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		color: transparent;
	}		

	.aichat-confirm-card {
		background: #2a2a2a;
		border-radius: 12px;
		padding: 20px;
		width: 300px;
		border: 1px solid #444;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}
	.aichat-confirm-message {
		color: #efefef;
		font-size: 14px;
		line-height: 1.5;
		margin-bottom: 16px;
		word-break: break-word;
		white-space: pre-line;
	}
	.btn-danger { background: #e74c3c; color: white; }
	.btn-danger:hover { background: #c0392b; }
	
`;