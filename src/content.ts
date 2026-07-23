/**
 * @file Entry point for the AIChatFolders application.
 * Handles the application lifecycle, UI mounting, and adapter binding.
 */
import type { LeftSidebarAdapter } from './adapters/LeftSidebar';
import { RightSidebar } from './ui/RightSidebar';
import { FolderManager } from './models/FolderManager';
import { GeminiAdapter } from './adapters/GeminiAdapter';
import { ChatGPTAdapter } from './adapters/ChatGPTAdapter';
import { DeepSeekAdapter } from './adapters/DeepSeekAdapter';
import { ClaudeAdapter } from './adapters/ClaudeAdapter';


/**
 * Core initialization function that assembles the UI and activates the adapter.
 * Runs asynchronously to fetch remote or local folder configurations.
 */
async function initializeApp() {

    const adapter = getAdapter();
	if (!adapter) return;

	// Check user login status and get User ID
	const userId = adapter.getAccountKey();
	if (!userId) {
		console.log('AIChatFolders: User is not logged in. Skipping plugin initialization.');
		return;
	}

	FolderManager.init(adapter);

    // Initialize UI
    const sidebar = new RightSidebar(adapter); 

    console.log('AIChatFolders: App initialized.');
}

/**
 * Detects the current host environment and returns the matching AI platform adapter.
 * @returns {LeftSidebarAdapter | null} The matching adapter instance, or null if unsupported.
 */
function getAdapter(): LeftSidebarAdapter | null {
    const host = window.location.hostname;

    if (host.includes('gemini.google.com')) {
        return new GeminiAdapter();

    } else if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
        return new ChatGPTAdapter();

    } else if (host.includes('chat.deepseek.com')) {
        return new DeepSeekAdapter();

    } else if (host.includes('claude.ai')) {
        return new ClaudeAdapter();
    }

    return null;
}

// Execute the entry function
initializeApp().catch(err => {
    console.error('AIChatFolders initialization failed:', err);
});