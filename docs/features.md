# 📁 AI Chat Folders — Feature Specification

## 1. Overview

**AI Chat Folders** is a browser extension that brings a familiar file-folder system to popular AI chat platforms, including ChatGPT, Gemini, Claude, and DeepSeek. It helps you organize hundreds of conversations into a structured hierarchy, dramatically improving your workflow efficiency.

- The extension stores **only metadata** (folder structures and chat references) locally in your browser.
- **It never copies, uploads, or backs up your conversation content.**
- Seamless integration into each platform's native sidebar and context menus, with a consistent and polished user interface.

---

## 2. Core Features

### 2.1 Folder Management

- **Create top-level folders**  
  Click the "➕" button in the extension panel header, enter a name, and pick a color.
- **Create subfolders**  
  Click the "➕" button on any folder card to add a child folder beneath it. Unlimited nesting is supported.
- **Edit folders**  
  Click the "✏️" button on a folder card to change its name or color.
- **Delete folders**  
  Click the "🗑️" button and confirm the action. Deleting a folder removes all its subfolders and chat references (the original conversations on the AI platform remain untouched).

### 2.2 Chat Management

- **Add a chat to a folder**  
  In the native conversation list of the AI platform, click the "Add to Folder" option from the context/more menu. A cascading folder tree appears, allowing you to pick any folder or subfolder.
- **Open chats from the sidebar**  
  All saved chats appear as clickable links in the extension panel. Clicking one navigates to that conversation on the target platform.
- **Remove a chat from a folder**  
  Hover over a chat item in the sidebar and click the "🗑️" button to remove its reference (the original chat on the platform remains untouched).

### 2.3 Smooth Navigation (SPA Support)

- When you click a chat link in the sidebar, the extension first attempts to simulate a click on the platform's native navigation element, triggering the SPA's client-side router.
- If the native element is not available, it falls back to using `history.pushState` + `popstate` events, minimizing full-page reloads for a smoother experience.

### 2.4 Drag & Drop Reordering

- **Everything is draggable** — both folders and chat items can be dragged to rearrange the tree structure.
- **Placement logic** (based on cursor position over the target card):
  - **Top 20%** → Place the item **before** the target.
  - **Middle 60%** → Place the item **inside** the target (as a child).
  - **Bottom 20%** → Place the item **after** the target.
- **Loop prevention**: The system prevents dragging a parent folder into itself or its own descendants, avoiding circular references.
- **Visual feedback**: During dragging, you'll see insertion lines, background highlights, and placeholder text indicating where the item will land.

### 2.5 Sidebar Panel

- **Position**: Fixed to the right edge of the browser window. Click the colored vertical tab on the edge to expand/collapse the panel.
- **Tree view**: Displays folders with indentation. Each folder has a toggle button (▶/▼) to expand or collapse its children.
- **Action buttons**: Hover over any folder card to reveal "Add Subfolder", "Edit", and "Delete" buttons.
- **Chat items**: Displayed as compact, minimalistic list entries, showing only the title and a delete button on hover.

### 2.6 Native Menu Integration

- On ChatGPT, Gemini, Claude, and DeepSeek, the extension dynamically injects an "Add to Folder" option into the platform's native context menu or action dropdown.
- Hovering over this option opens a cascading submenu that displays the user's entire folder hierarchy, supporting multi-level navigation.
- Clicking a folder instantly saves the current chat to that folder, automatically opens the sidebar, and flashes the newly added node with a green highlight.

---

## 3. User Experience

- **Dark mode native**: All UI elements use a dark theme that harmonizes with the dark modes of mainstream AI platforms.
- **Platform-specific accent colors**: The dock trigger (right-edge tab) changes color based on the active platform — Green for ChatGPT, Orange for Claude, Blue for DeepSeek, and a Google 4-color gradient for Gemini.
- **Smooth animations**: Hover effects, panel sliding, folder collapsing/expanding, and menu popups all feature fluid CSS transitions.
- **Visual feedback for new additions**: When a chat is saved to a folder, the corresponding card pulses with a green glow three times, making it easy to locate.

---

## 4. Technical Implementation

### 4.1 Architecture

The project follows the **Adapter Pattern** to ensure cross-platform reusability:

- **`LeftSidebarAdapter` (abstract base class)**: Defines the unified interface (`getAccountKey`, `getChatInfo`, `smoothNavigate`, etc.) and provides common utilities like cascading menu rendering and delayed close timers.
- **Platform-specific subclasses** (`ChatGPTAdapter`, `GeminiAdapter`, `ClaudeAdapter`, `DeepSeekAdapter`): Implement platform-specific DOM selectors, event capture strategies, user identification logic, and routing methods.

**UI Layer**:
- **`RightSidebar`**: Renders the panel, handles user interactions (clicks, drag-and-drop), and manages global event listeners.
- **`FolderEditor`**: Provides an inline form for creating/editing folders.

**Data Layer**:
- **`FolderManager`**: A singleton class that encapsulates all `chrome.storage.local` operations, providing CRUD, reordering, and collapse-state management methods.

### 4.2 Data Storage

- **Engine**: `chrome.storage.local` — persistent, local-only storage.
- **Storage Key format**: `acf_{platformId}_{sanitizedUserId}`. This isolates data per platform and per user account.
- **Data structure**: Stores a `FolderData[]` array representing the entire tree. Each node contains:
  - `id`, `name`, `color`, `parentId`
  - `children`: `FolderData[]`
  - `isCollapsed`: `boolean`
  - `isChat`: `boolean` — if `true`, the node is a chat leaf (contains no children).
- **Chat nodes**: Only store `id`, `title`, and a dynamically resolved `url`. The actual conversation content remains on the AI platform.

### 4.3 Platform Adaptation Details

| Platform  | User ID Strategy                                                                 | Navigation Strategy                                                                             | Menu Injection Selector                                          |
|-----------|----------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| ChatGPT   | Parse `session.account.id` from the `#client-bootstrap` script.                  | Click `a[href*="/c/"]` natively; fallback to History API.                                      | `[role="menu"] > div[role="group"]:last-child`                   |
| Gemini    | Extract from `<meta name="og-profile-acct">` or the `WIZ_global_data` script.    | Scroll load the history list and click the matching link; fallback to full page reload.         | `div.mat-mdc-menu-content`                                       |
| Claude    | Read localStorage keys (`__qk_hint_account_uuid`) or via a MAIN-world bridge.    | Click `a[href*="/chat/"]` natively; fallback to History API.                                   | `[role="menu"] div:first-child`                                  |
| DeepSeek  | Read `localStorage.userToken` and call `/api/v0/users/current`.                  | Click `a[href*="/a/chat/s/"]` natively; fallback to History API.                               | `.ds-floating-position-wrapper .ds-dropdown-menu`               |

> **Claude MAIN-world bridge**: Because content scripts run in an isolated world and cannot access React Fiber properties, the extension injects `claude-main-bridge.js` into the MAIN world. It uses an event-driven mechanism (`CustomEvent`) to securely pass the account UUID back to the isolated world.

### 4.4 Security & Privacy

- **Minimal permissions**: The extension only requests the `storage` permission. It makes no external network requests (except DeepSeek's authenticated user API call, which is required to fetch the user ID).
- **Zero conversation data**: Only `id`, `title`, and `url` are stored. The `title` is used for display purposes only and is not relied upon for navigation.
- **Account isolation**: Different accounts on the same platform use distinct storage keys, ensuring no cross-account data leakage.

---

## 5. Important Notes

- **Login detection**: The extension only activates after confirming the user is logged in, preventing interference with unauthenticated pages.
- **Chat deletion sync**: If a user deletes a conversation directly on the AI platform, the extension **does not automatically remove** its reference (since the platform offers no deletion event). Clicking the orphaned entry will fail gracefully, and users can manually remove it via the delete button.
- **Browser compatibility**: Currently supports Chrome and Edge (based on Chromium) with Manifest V3. Firefox support is planned.

---

## 6. Roadmap

- **Import/Export**: Backup or migrate folder structures between browsers.
- **More platforms**: Support for Poe, Perplexity, Bing Chat, and others.
- **Enhanced search**: Quickly find folders or chats within the sidebar.
- **Internationalization (i18n)**: Localize the UI into multiple languages.

---

> This document evolves with the project. If you find any discrepancies, please feel free to update it or open an issue.