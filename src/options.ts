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
 * Handle configuration JSON export
 */
function setupExport(): void {
	const exportBtn = document.getElementById('exportBtn');
	if (!exportBtn) return;

	exportBtn.addEventListener('click', async () => {
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

			const payload = {
				local: filterAcf(localData),
				sync: filterAcf(syncData),
			};

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
 * Handle configuration JSON import
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

		const reader = new FileReader();
		reader.onload = async (e: ProgressEvent<FileReader>) => {
		try {
			const content = e.target?.result as string;
			const parsed = JSON.parse(content);

			if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('Invalid data format: not an object.');
			}

			// Support both the new { local, sync } export shape and a legacy
			// flat export (everything used to live in chrome.storage.local).
			const localPart: Record<string, any> = (parsed.local && typeof parsed.local === 'object') ? parsed.local : parsed;
			const syncPart: Record<string, any> = (parsed.sync && typeof parsed.sync === 'object') ? parsed.sync : {};

			const hasValidKeys =
			Object.keys(localPart).some((key) => key.startsWith('acf_')) ||
			Object.keys(syncPart).some((key) => key.startsWith('acf_'));
			if (!hasValidKeys) {
			throw new Error('No valid AIChatFolders data found in the file.');
			}

			await Promise.all([
			Object.keys(localPart).length ? chrome.storage.local.set(localPart) : Promise.resolve(),
			Object.keys(syncPart).length ? chrome.storage.sync.set(syncPart) : Promise.resolve(),
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
  setupCollapsibles();
  setupExport();
  setupImport();
});