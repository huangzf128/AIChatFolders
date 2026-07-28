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

`;