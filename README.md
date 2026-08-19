# AI Chat Folders

> Organize conversations across your favorite AI chat platforms with folders.

A lightweight browser extension that brings a familiar folder system to today's AI chat platforms.

AI Chat Folders helps you organize your AI conversations without copying or storing the conversations themselves.

**Currently supports ChatGPT, Gemini, Claude, and DeepSeek.**

## ✨ Features

* 📁 Create folders and subfolders to organize your AI conversations
* 💬 Save conversations into folders
* 🎯 Native integration with each AI platform
* 🚀 Lightweight and fast
* 💾 Local storage — your folder data stays in your browser
* 🌙 Works with dark mode
* 🖱️ Drag & drop folders and chats
* 👤 Keep folders separate for different logged-in accounts, where supported
* 🔄 Automatically sync native chat renames and deletions with your folders
* 🙈 Optionally hide chats from the native sidebar after saving them to a folder
* ⚙️ Per-platform settings and native sync controls
* 📤 Export and import your entire folder structure as a JSON file
* 🌐 Available in English, Japanese, and Chinese

## Supported Platforms

| Platform | Support |
| -------- | ------- |
| ChatGPT  | ✅       |
| Gemini   | ✅       |
| Claude   | ✅       |
| DeepSeek | ✅       |

More platforms are planned.

## Why AI Chat Folders?

AI chat platforms have become part of our daily workspace.

However, after hundreds of conversations, finding an old discussion can become difficult.

AI Chat Folders adds a familiar folder system so you can organize conversations just like files on your computer.

For example:

```text
📁 Work
   ├── 📁 Spring Boot
   ├── 📁 AWS
   └── 📁 PostgreSQL

📁 Personal
   ├── 📁 Travel
   └── 📁 Learning

📁 Side Projects
   ├── 📁 AIChatFolders
   └── 📁 Portfolio
```

## Installation

### Chrome Web Store

Install AI Chat Folders directly from the Chrome Web Store:

**Chrome Web Store — AI Chat Folders**

The Chrome Web Store version is recommended for normal use and will receive updates through the browser.

### Build from Source

For developers or users who prefer to install the extension manually:

```bash
git clone https://github.com/huangzf128/AIChatFolders.git

cd AIChatFolders

npm install

npm run build
```

Then load the extension in Chrome using Developer Mode.

## First-Time Setup

After installing AI Chat Folders, a short first-time guide will help you understand how to use the extension.

You can also find detailed instructions and explanations in the project documentation.

* [Documentation](https://huangzf128.github.io/AIChatFolders/)
* [Wiki](https://github.com/huangzf128/AIChatFolders/wiki)
* [Changelog](https://github.com/huangzf128/AIChatFolders/blob/main/docs/CHANGELOG.md)

## Settings

Open the extension's options page to:

* Enable or disable AI Chat Folders for each supported platform
* Configure native chat synchronization
* Export your folder structure as a JSON file
* Import a previous backup

Settings sections can be expanded or collapsed from the options page.

For detailed information about each setting, see the [Wiki](https://github.com/huangzf128/AIChatFolders/wiki).

## Important

AI Chat Folders does **not** store or back up your conversations.

The extension only stores folder information and the relationship between folders and conversations.

If you delete a conversation from ChatGPT, Gemini, Claude, or DeepSeek, the conversation is permanently removed from the platform and will also disappear from AI Chat Folders.

When native chat sync is enabled, renaming or deleting a chat from the platform's native sidebar will also update or remove the corresponding entry in AI Chat Folders.

You can disable native synchronization from the settings page if you prefer to manage your folders independently.

> Think of AI Chat Folders as a file manager for your AI conversations — it organizes them, but it does not own or copy them.

## Privacy

AI Chat Folders is designed with privacy in mind.

* Your conversations are never copied.
* Your conversations are never uploaded.
* The extension only stores folder metadata locally in your browser.
* No analytics.
* No tracking.
* No account required.

## Documentation

For detailed information about features, settings, synchronization, storage, and usage, see:

* **[Documentation](https://huangzf128.github.io/AIChatFolders/)** — detailed feature documentation
* **[Wiki](https://github.com/huangzf128/AIChatFolders/wiki)** — user guides and settings reference
* **[Changelog](https://github.com/huangzf128/AIChatFolders/blob/main/docs/CHANGELOG.md)** — version history

## Roadmap

AI Chat Folders is actively evolving.

Planned improvements include:

* More AI platforms
* Firefox support
* Further improvements to synchronization and backup
* Improvements based on user feedback

## Contributing

Contributions, bug reports, and feature requests are always welcome.

Feel free to open an Issue or submit a Pull Request.

## License

MIT License
