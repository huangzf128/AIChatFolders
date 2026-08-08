# AI Chat Folders

> Organize conversations across your favorite AI chat platforms with folders.

A lightweight browser extension that brings a familiar folder system to today's AI chat platforms.

Currently supports ChatGPT, Gemini, Claude, DeepSeek, and more coming soon.

> **AI Chat Folders organizes your AI workspace without copying or storing your conversation content.**

---

## Features

- 📁 Create folders and subfolders to organize your AI conversations
- 💬 Save conversations into folders
- 🎯 Native integration with each AI platform
- 🚀 Lightweight and fast
- 💾 Local storage only — your data never leaves your browser
- 🌙 Works with dark mode
- 🖱️ Drag & drop folders and chats
- 👤 Folders are kept separate per logged-in account, on platforms that support multiple accounts
- 🔄 Renaming or deleting a chat in the native sidebar automatically updates it in your folders too
- 🙈 Optionally hide chats from the native sidebar once they're saved into a folder, to cut down on clutter
- ⚙️ A settings page to enable/disable the extension per platform and configure sync behavior
- 📤 Export and import your entire folder structure as a JSON file
- 🌐 Available in English, Japanese, and Chinese

---

## Supported Platforms

- ✅ ChatGPT
- ✅ Gemini
- ✅ Claude
- ✅ DeepSeek

More platforms are planned.

---

## Why AI Chat Folders?

AI chat platforms have become our daily workspace.

However, after hundreds of conversations, finding an old discussion becomes difficult.

AI Chat Folders adds a familiar folder system so you can organize conversations just like files on your computer.

For example:

```
📁 Work
    📁 Spring Boot
    📁 AWS
    📁 PostgreSQL

📁 Personal
    📁 Travel
    📁 Learning English

📁 Side Projects
    📁 AIChatFolders
    📁 Portfolio
```

---

## Installation

### Chrome Web Store

Coming soon.

### Build from source

```bash
git clone https://github.com/huangzf128/AIChatFolders.git

cd AIChatFolders

npm install

npm run build
```

Then load the extension in Chrome using **Developer Mode**.

---

## Settings

Open the extension's options page to:

- Enable or disable AI Chat Folders on a per-platform basis
- Turn on/off automatic syncing when a chat is renamed or deleted in a platform's native sidebar
- Export your folders to a JSON file, or import a previous backup

Each settings section can be collapsed/expanded from the options page.

---

## Screenshots

Coming soon.

---

## Roadmap

### Phase 1 — Foundation

- [x] ChatGPT support
- [x] Gemini support
- [x] Claude support
- [x] DeepSeek support
- [x] Folder management
- [x] Settings page (per-platform enable/disable, sync toggle)
- [x] Hide native sidebar entries already saved to a folder
- [x] Auto-sync native renames/deletions into local folders

### Phase 2 — Better Organization

- [x] Export / Import
- [x] Separate folders for each AI account
- [ ] Folder-level backup scheduling (e.g. periodic auto-export)

### Phase 3 — Ecosystem

- [ ] More AI platforms
- [ ] Firefox support

---

## Important

AI Chat Folders **does not store or back up your conversations**.

The extension only stores folder information and the relationship between folders and conversations.

If you delete a conversation from ChatGPT, Gemini, Claude, or DeepSeek, it is permanently removed from the platform and will also disappear from AI Chat Folders.

If the native sync setting is enabled (default: on), renaming or deleting a chat directly on the platform's own sidebar will also update or remove it inside AI Chat Folders automatically — you don't need to manage both places separately. You can turn this off from the settings page if you'd rather manage folders independently from the native sidebar.

Think of AI Chat Folders as a file manager—it organizes your conversations, but it does not own or copy them.

## Privacy

AI Chat Folders is designed with privacy in mind.

- Your conversations are **never copied**.
- Your conversations are **never uploaded**.
- The extension only stores folder metadata locally in your browser.
- No analytics.
- No tracking.
- No account required.

---

## Contributing

Contributions, bug reports, and feature requests are always welcome.

Feel free to open an Issue or submit a Pull Request.

---

## License

MIT License