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

/**
 * Discriminates which kind of native-UI change is being reported for a
 * chat. Add new members here (e.g. 'pin', 'archive') as more native
 * signals get intercepted — no event/method renaming required.
 */
export type NativeChangeType = 'delete' | 'rename';
/**
 * Preferences tied to the currently logged-in account on this platform.
 * Requires a resolvable userId, so anything here is only readable/
 * writable once an account is known (e.g. from the right sidebar).
 */
export interface AccountSettings {
  /** Whether chats already saved to a folder should be hidden from the native sidebar. */
  hideChat: boolean;
}
export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  hideChat: false,
};

/**
 * Preferences tied to the platform/domain as a whole, independent of
 * which account (if any) is currently logged in. Managed from the
 * extension's upcoming settings page, which may be opened before login
 * or without ever resolving a userId — so nothing here may depend on
 * LeftSidebarAdapter.getResolvedAccountKey().
 */
export interface DomainSettings {
  /**
   * Whether native platform changes detected via network interception /
   * DOM signals (currently: delete; planned: rename) should also be
   * applied to the corresponding entries in local folders.
   */
  syncNativeChanges: boolean;
}
export const DEFAULT_DOMAIN_SETTINGS: DomainSettings = {
  syncNativeChanges: true,
};

/** Full shape persisted under a single per-account chrome.storage.local key. */
export interface StorageSchema {
  folders: FolderData[];
  settings: AccountSettings;
}