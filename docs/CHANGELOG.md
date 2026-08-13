# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
-

### Changed
- Optimized local storage layout: shorter folder ids, numeric color
  codes, byte-based name limits, a more compact on-disk tree shape, and
  a single merged global setting (`enabled`/`syncNativeChanges`) synced
  across devices via chrome.storage.sync.

### Fixed
- Fixed the folder editor's color picker and name input overflowing the
  panel on Gemini and DeepSeek, caused by injected UI relying on the
  host page's own CSS reset.
  

## [1.0.0] - 2026-08-08

### Added
- Create folders and subfolders to organize conversations across ChatGPT, Gemini, Claude, and DeepSeek.
- Save conversations into folders, with drag & drop support for both folders and chats.
- Native integration with each platform's sidebar, including dark mode support.
- Automatic sync of native chat renames and deletions into local folders, so folders never point to a chat that no longer exists — supported across all four platforms.
- Optional toggle to hide native sidebar chats that are already saved to a folder, avoiding duplicate entries.
- Folders are kept separate per logged-in account on platforms that support multiple accounts.
- Settings page to enable/disable the extension on a per-platform basis, with collapsible sections for easier navigation.
- Toggling native chat sync in the settings page now takes effect immediately on already-open tabs, without needing a page refresh.
- Export and import your entire folder structure as a JSON file, for backup or transferring between browsers.
- Available in English, Japanese, and Chinese.
- Local storage only — no account required, no analytics, no tracking, and conversations are never copied or uploaded.