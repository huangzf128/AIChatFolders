/**
 * src/ui/FolderEditor.ts
 */
import { FolderManager } from '../models/FolderManager';
import type { FolderData, ChatItem } from '../models/Folder';

export class FolderEditor {

    static render(
		onSave: () => void, 
		onCancel: () => void, 
		parentId: string | null = null,
		existingData?: FolderData): HTMLElement {

        const PRESET_COLORS = ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', '#f39c12', '#8e44ad', '#fd79a8'];
		let selectedColor: string = PRESET_COLORS[0] as string;
		const initialName = existingData ? existingData.name : '';
    	const saveBtnText = existingData ? 'Update' : 'Create';

        const form = document.createElement('div');
        form.className = 'aichat-edit-card';

        form.innerHTML = `
			<input type="text" class="aichat-input" id="new-folder-name" autocomplete="off"
						placeholder="Folder Name..." value="${initialName}" maxlength="40" autofocus>
            <div class="aichat-color-picker">
				${PRESET_COLORS.map((c) => {
					const isActive = c === selectedColor ? 'active' : '';
					return `<div class="aichat-color-option ${isActive}" style="background: ${c}" data-color="${c}"></div>`;
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
                selectedColor = (dot as HTMLElement).dataset.color!;
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