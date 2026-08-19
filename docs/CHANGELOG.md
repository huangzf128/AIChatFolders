# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

*No changes yet.*

## [1.2.0] - 2026-08-19

### Added

* Added a first-time user guide to help new users get started with AI Chat Folders.
* Improved user documentation and reorganized the Wiki and feature documentation.

### Changed

* Optimized the local storage layout:

  * Shorter folder IDs
  * Numeric color codes
  * Byte-based name limits
  * A more compact on-disk tree structure
  * A single merged global setting (`enabled` / `syncNativeChanges`) synchronized across devices via `chrome.storage.sync`
* Improved the overall user experience and documentation.

### Fixed

* Fixed an issue where **Add To Folder** failed to work on Claude after a recent DOM update.
* Fixed the folder editor's color picker and name input overflowing the panel on Gemini and DeepSeek, caused by injected UI relying on the host page's CSS reset.

## [1.0.0] - 2026-08-08

### Added

* Create folders and subfolders to organize conversations across ChatGPT, Gemini, Claude, and DeepSeek.
* Save conversations into folders, with drag & drop support for both folders and chats.
* Native integration with each platform's sidebar, including dark mode support.
* Automatic sync of native chat renames and deletions into local folders, so folders never point to a chat that no longer exists.
* Optional toggle to hide native sidebar chats that are already saved to a folder, avoiding duplicate entries.
* Folders are kept separate per logged-in account on platforms that support multiple accounts.
* Settings page to enable or disable the extension on a per-platform basis.
* Native chat sync settings that take effect immediately on already-open tabs.
* Export and import of the entire folder structure as a JSON file, for backup or transferring between browsers.
* Available in English, Japanese, and Chinese.
* Local storage only — no account required, no analytics, no tracking, and conversations are never copied or uploaded.
