/**
 * src/ui/FolderEditor.ts
 */
import { FolderManager } from '../models/FolderManager';
import type { FolderData } from '../models/Folder';
import { COLOR_TABLE, DEFAULT_COLOR_CODE } from '../models/Folder';

export class FolderEditor {

    static render(
		onSave: () => void, 
		onCancel: () => void, 
		parentId: string | null = null,
		existingData?: FolderData): HTMLElement {

        const colorCodes = Object.keys(COLOR_TABLE).map(Number);
		let selectedColor: number = existingData ? existingData.color : DEFAULT_COLOR_CODE;
		const initialName = existingData ? existingData.name : '';
    	const saveBtnText = existingData ? 'Update' : 'Create';

        const form = document.createElement('div');
        form.className = 'aichat-edit-card';

        form.innerHTML = `
			<input type="text" class="aichat-input" id="new-folder-name" autocomplete="off"
						placeholder="Folder Name..." value="${initialName}" maxlength="40" autofocus>
            <div class="aichat-color-picker">
				${colorCodes.map((code) => {
					const isActive = code === selectedColor ? 'active' : '';
					return `<div class="aichat-color-option ${isActive}" style="background: ${COLOR_TABLE[code]}" data-color="${code}"></div>`;
				}).join('')}            
            </div>
            <div class="aichat-btn-group">
                <button class="aichat-btn btn-cancel">Cancel</button>
                <button class="aichat-btn btn-save">${saveBtnText}</button>
            </div>
        `;

        form.querySelectorAll('.aichat-color-option').forEach(dot => {
            dot.addEventListener('click', () => {
                form.querySelectorAll('.aichat-color-option').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                selectedColor = Number((dot as HTMLElement).dataset.color);
            });
        });

        form.querySelector('.btn-save')?.addEventListener('click', async () => {
            const name = (form.querySelector('#new-folder-name') as HTMLInputElement).value.trim();
            if (name) {
                if (existingData) {
					await FolderManager.updateFolder(existingData.id, { name, color: selectedColor });
				} else {
					await FolderManager.addFolder(name, selectedColor, parentId);
				}
                onSave();
                form.remove();
            }
        });

        form.querySelector('.btn-cancel')?.addEventListener('click', onCancel);
        return form;
    }
}