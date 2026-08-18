import { FolderManager } from './models/FolderManager';
import type { DomainSettings } from './models/Folder';

type PlatformKey = 'gemini' | 'chatgpt' | 'claude' | 'deepseek';
const PLATFORMS: PlatformKey[] = ['gemini', 'chatgpt', 'claude', 'deepseek'];

/**
 * Apply i18n translations to elements with data-i18n attribute
 */
function applyI18n(): void {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const translation = chrome.i18n.getMessage(key);
      if (translation) {
        el.textContent = translation;
      }
    }
  });
}

/**
 * Show a quick toast notification on auto-save
 */
function showToast(messageKey: string = 'saved'): void {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  if (!toast || !toastMsg) return;

  const msg = chrome.i18n.getMessage(messageKey) || 'Saved!';
  toastMsg.textContent = msg;
  toast.classList.add('show');

  // Clear existing timeout if toggled rapidly
  if ((toast as any)._timer) clearTimeout((toast as any)._timer);
  (toast as any)._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

/**
 * Load and bind synchronization settings for all supported platforms.
 * Delegates key format + field shape entirely to FolderManager/DomainSettings,
 * so the options page can never drift out of sync with content.ts again.
 */
async function loadSettings(): Promise<void> {
  for (const platform of PLATFORMS) {
    try {
      const settings: DomainSettings = await FolderManager.getDomainSettings(platform);

      // 1. Enable switch
      const enableCheckbox = document.getElementById(`enable_${platform}`) as HTMLInputElement | null;
      if (enableCheckbox) {
        enableCheckbox.checked = settings.enabled;
        enableCheckbox.addEventListener('change', async () => {
          try {
            await FolderManager.updateDomainSettings({ enabled: enableCheckbox.checked }, platform);
            showToast('saved');
          } catch (error) {
            console.error(`[AIChatFolders] Failed to save ${platform} enable setting:`, error);
          }
        });
      }

      // 2. Sync switch
      const syncCheckbox = document.getElementById(`sync_${platform}`) as HTMLInputElement | null;
      if (syncCheckbox) {
        syncCheckbox.checked = settings.syncNativeChanges;
        syncCheckbox.addEventListener('change', async () => {
          try {
            await FolderManager.updateDomainSettings({ syncNativeChanges: syncCheckbox.checked }, platform);
            showToast('saved');
          } catch (error) {
            console.error(`[AIChatFolders] Failed to save ${platform} sync setting:`, error);
          }
        });
      }
    } catch (error) {
      console.error(`[AIChatFolders] Failed to load settings for ${platform}:`, error);
    }
  }
}

/**
 * Load and bind the single global cloud-sync switch. Unlike the per-platform
 * settings above, this only ever flips the `cs` flag in the shared
 * chrome.storage.sync setting item — it deliberately does NOT push/pull any
 * actual folder/chat data itself, since the options page has no platform
 * adapter and thus no resolved account to attribute that data to. The
 * actual reconciliation happens in each open tab's content script once it
 * notices the flag change (see RightSidebar's cloud-sync watcher).
 */
async function loadCloudSyncToggle(): Promise<void> {
  const toggle = document.getElementById('cloud_sync_toggle') as HTMLInputElement | null;
  if (!toggle) return;

  try {
    toggle.checked = await FolderManager.isCloudSyncEnabled();
  } catch (error) {
    console.error('[AIChatFolders] Failed to load cloud sync setting:', error);
  }

  toggle.addEventListener('change', async () => {
    try {
      await FolderManager.setCloudSyncEnabled(toggle.checked);
      showToast('saved');
    } catch (error) {
      console.error('[AIChatFolders] Failed to save cloud sync setting:', error);
    }
  });
}

/**
 * Setup collapsible behavior for ALL sections marked with
 * .collapsible-header[data-target]. This is generic on purpose:
 * any section can opt into collapsing just by adding the
 * data-target attribute (pointing at the id of its content block),
 * without touching this function again.
 */
function setupCollapsibles(): void {
  const headers = document.querySelectorAll<HTMLElement>('.collapsible-header[data-target]');

  headers.forEach((header) => {
    const targetId = header.dataset.target;
    if (!targetId) return;

    const content = document.getElementById(targetId);
    const toggleText = header.querySelector<HTMLElement>('.toggle-text');

    if (!content) {
      console.error(`[AIChatFolders] Collapsible target #${targetId} not found`);
      return;
    }

    // Reflect initial state for accessibility (screen readers)
    header.setAttribute('aria-expanded', String(header.classList.contains('open')));

    header.addEventListener('click', () => {
      const isOpen = header.classList.toggle('open');
      content.classList.toggle('open', isOpen);
      header.setAttribute('aria-expanded', String(isOpen));

      // Update state hint text based on current collapse status
      if (toggleText) {
        const msgKey = isOpen ? 'collapseText' : 'expandText';
        const fallbackText = isOpen ? 'Click to collapse' : 'Click to expand';
        toggleText.textContent = chrome.i18n.getMessage(msgKey) || fallbackText;
      }
    });
  });
}

/**
 * The three independently-selectable data categories, mirroring the three
 * storage locations described in docs/features/CloudSync.md:
 * - common: the single shared { td, snc, cs } item on chrome.storage.sync
 *   (acf_setting).
 * - syncFolders: every other acf_* key on chrome.storage.sync (acf_folders,
 *   acf_c_*, acf_s_*) — the folder tree + per-account chat filing + account
 *   settings used while cloud sync is active.
 * - localFolders: every acf_* key on chrome.storage.local — the per-account
 *   folder tree + settings used while cloud sync is off.
 */
interface CategorySelection {
	common: boolean;
	syncFolders: boolean;
	localFolders: boolean;
}

/** Reads the checked state of a category checkbox trio sharing the given id prefix. */
function readCategorySelection(idPrefix: 'export' | 'import'): CategorySelection {
	const isChecked = (id: string): boolean => (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
	return {
		common: isChecked(`${idPrefix}_common`),
		syncFolders: isChecked(`${idPrefix}_syncFolders`),
		localFolders: isChecked(`${idPrefix}_localFolders`),
	};
}

/**
 * Splits a raw chrome.storage.sync snapshot into the "common settings" item
 * (acf_setting) and everything else (folder tree + chat refs + per-account
 * settings), both filtered to acf_* keys only.
 */
function splitSyncData(syncData: Record<string, any>): { commonSettings: Record<string, any>; syncFolders: Record<string, any> } {
	const settingKey = FolderManager.getGlobalSettingStorageKey();
	const commonSettings: Record<string, any> = {};
	const syncFolders: Record<string, any> = {};
	for (const [key, value] of Object.entries(syncData)) {
		if (!key.startsWith('acf_')) continue;
		if (key === settingKey) commonSettings[key] = value;
		else syncFolders[key] = value;
	}
	return { commonSettings, syncFolders };
}

/**
 * Handle configuration JSON export. Only the categories the user has
 * checked (see the Export checkboxes in options.html) are included in the
 * resulting file.
 */
function setupExport(): void {
	const exportBtn = document.getElementById('exportBtn');
	if (!exportBtn) return;

	exportBtn.addEventListener('click', async () => {
		const selection = readCategorySelection('export');
		if (!selection.common && !selection.syncFolders && !selection.localFolders) {
			alert(chrome.i18n.getMessage('exportNothingSelected') || 'Please select at least one data category to export.');
			return;
		}

		try {
			const [localData, syncData] = await Promise.all([
				chrome.storage.local.get(null),
				chrome.storage.sync.get(null),
			]);

			const filterAcf = (data: Record<string, any>): Record<string, any> => {
				const out: Record<string, any> = {};
				for (const [key, value] of Object.entries(data)) {
				if (key.startsWith('acf_')) out[key] = value;
				}
				return out;
			};

			const { commonSettings, syncFolders } = splitSyncData(syncData);

			// Only categories the user checked are written into the payload at
			// all — an unchecked category doesn't even appear as an empty key,
			// so a re-import of this file can't accidentally wipe it.
			const payload: { commonSettings?: Record<string, any>; syncFolders?: Record<string, any>; localFolders?: Record<string, any> } = {};
			if (selection.common) payload.commonSettings = commonSettings;
			if (selection.syncFolders) payload.syncFolders = syncFolders;
			if (selection.localFolders) payload.localFolders = filterAcf(localData);

			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `AIChatFolders_Backup_${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('[AIChatFolders] Export failed:', error);
			alert('Export failed. Please check the console for details.');
		}
	});
}

/**
 * Normalizes any supported export file shape into the same three-category
 * view ({ commonSettings, syncFolders, localFolders }), so the rest of the
 * import logic never needs to know which shape the file originally used:
 * - Current shape: already split into the three categories by setupExport()
 *   above (any subset of the three keys may be present, since export only
 *   includes the categories the user had checked).
 * - Legacy shape: { local, sync } (or a bare flat object that IS the local
 *   part, from before the { local, sync } split existed). The sync part is
 *   further split into commonSettings/syncFolders using the same acf_setting
 *   key check as splitSyncData() above.
 */
function normalizeImportPayload(parsed: any): { commonSettings: Record<string, any>; syncFolders: Record<string, any>; localFolders: Record<string, any> } {
	if (parsed.commonSettings || parsed.syncFolders || parsed.localFolders) {
		return {
			commonSettings: parsed.commonSettings || {},
			syncFolders: parsed.syncFolders || {},
			localFolders: parsed.localFolders || {},
		};
	}

	const localPart: Record<string, any> = (parsed.local && typeof parsed.local === 'object') ? parsed.local : parsed;
	const syncPart: Record<string, any> = (parsed.sync && typeof parsed.sync === 'object') ? parsed.sync : {};
	const { commonSettings, syncFolders } = splitSyncData(syncPart);

	return { commonSettings, syncFolders, localFolders: localPart };
}

/**
 * Handle configuration JSON import. Only categories that are BOTH present
 * in the file AND checked by the user (see the Import checkboxes in
 * options.html) are written — a category missing from the file is simply a
 * no-op even if checked, and an unchecked category is skipped even if the
 * file has it.
 */
function setupImport(): void {
	const importBtn = document.getElementById('importBtn');
	const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
	if (!importBtn || !fileInput) return;

	importBtn.addEventListener('click', () => {
		fileInput.click();
	});

	fileInput.addEventListener('change', (event: Event) => {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const selection = readCategorySelection('import');
		if (!selection.common && !selection.syncFolders && !selection.localFolders) {
			alert(chrome.i18n.getMessage('importNothingSelected') || 'Please select at least one data category to import.');
			target.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = async (e: ProgressEvent<FileReader>) => {
		try {
			const content = e.target?.result as string;
			const parsed = JSON.parse(content);

			if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('Invalid data format: not an object.');
			}

			const normalized = normalizeImportPayload(parsed);

			const localToWrite: Record<string, any> = selection.localFolders ? normalized.localFolders : {};
			const syncToWrite: Record<string, any> = {
				...(selection.common ? normalized.commonSettings : {}),
				...(selection.syncFolders ? normalized.syncFolders : {}),
			};

			const hasValidKeys =
			Object.keys(localToWrite).some((key) => key.startsWith('acf_')) ||
			Object.keys(syncToWrite).some((key) => key.startsWith('acf_'));
			if (!hasValidKeys) {
			throw new Error('No valid AIChatFolders data found for the selected categories.');
			}

			await Promise.all([
			Object.keys(localToWrite).length ? chrome.storage.local.set(localToWrite) : Promise.resolve(),
			Object.keys(syncToWrite).length ? chrome.storage.sync.set(syncToWrite) : Promise.resolve(),
			]);

			const successMsg = chrome.i18n.getMessage('importSuccess') || 'Import succeeded! Reloading...';
			alert(successMsg);
			window.location.reload();
		} catch (err) {
			console.error('Failed to parse JSON file:', err);
			const failMsg = chrome.i18n.getMessage('importFailed') || 'Invalid JSON file.';
			alert(failMsg);
		}
		};
		reader.readAsText(file);
		target.value = '';
	});
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[AIChatFolders] Options page loaded');
  applyI18n();
  loadSettings();
  loadCloudSyncToggle();
  setupCollapsibles();
  setupExport();
  setupImport();
});