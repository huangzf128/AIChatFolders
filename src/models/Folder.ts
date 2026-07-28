/**
 * @file Folder.ts
 * @description Type definitions and interfaces for the AI Chat Folders structure.
 */

/**
 * Represents an individual chat session telemetry mapped from the AI platform.
 */
export interface ChatItem {
    id: string;
    title: string;
    url: string;
}

/**
 * Core interface representing a node within the unified hierarchical tree.
 * A node can functionally act as a container (folder) or a leaf node (chat shortcut).
 */
export interface FolderData {
    /** Unique identifier for the folder or chat node */
    id: string;
    /** Display name of the folder or the title of the chat session */
    name: string;
    /** UI state flag indicating whether the folder's view expanded or collapsed */
    isCollapsed?: boolean;
    /** Hex color code or class token for theme custom styling */
    color: string;
    /** ID of the parent container; explicitly `null` for root-level entries */
    parentId: string | null;
    /** Recursive list of subfolders or embedded chat leaves nested under this node */
    children: FolderData[];
    /** Legacy array for flat chat items; prefer pushing nested nodes into 'children' with 'isChat' set to true */
    items: ChatItem[];

    /** Discriminator flag; true if this node is a stylized chat leaf rather than an abstract folder */
    isChat?: boolean;
}

export const DEFAULT_SETTINGS: SettingsData = {
  hideChat: false,
};

/** User-level preferences stored alongside the folder tree. */
export interface SettingsData {
  /** Whether chats already saved to a folder should be hidden from the native sidebar. */
  hideChat: boolean;
}

/** Full shape persisted under a single chrome.storage.local key. */
export interface StorageSchema {
  folders: FolderData[];
  settings: SettingsData;
}