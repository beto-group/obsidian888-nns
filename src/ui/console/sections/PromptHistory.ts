import type { App } from 'obsidian';
import type { BaseHistoryEntry, ImageHistoryEntry } from '../AiConsoleModal';

// Type guard to check if entry is ImageHistoryEntry
function isImageHistoryEntry(entry: BaseHistoryEntry): entry is ImageHistoryEntry {
    return 'imageUrls' in entry;
}

export class PromptHistory {
    private container?: HTMLElement;

    constructor() {}

    render(container: HTMLElement, onClick: (entry: BaseHistoryEntry) => void) {
        this.container = container.createEl('div', { cls: 'ai-console-history-section' });
        this.container.createEl('h4', { text: 'History' });
        this.updateHistory([], onClick);
    }

    updateHistory<T extends BaseHistoryEntry>(history: T[], onClick: (entry: T) => void) {
        if (!this.container) return;

        const historyContainer = this.container.querySelector('.ai-console-history') || this.container.createEl('div', { cls: 'ai-console-history' });
        historyContainer.empty();

        if (history.length === 0) {
            historyContainer.createEl('p', { text: 'No history yet.' });
            return;
        }

        history.forEach((entry, index) => {
            const entryEl = historyContainer.createEl('div', { cls: 'ai-console-history-entry' });
            entryEl.createEl('p', { text: `Prompt: ${entry.prompt.slice(0, 50)}${entry.prompt.length > 50 ? '...' : ''}` });
            entryEl.createEl('p', { text: `Provider: ${entry.provider}` });
            entryEl.createEl('p', { text: `Model: ${entry.model}` });
            entryEl.createEl('p', { text: `Time: ${entry.timestamp}` });

            // Display image thumbnail for image entries
            if (isImageHistoryEntry(entry) && entry.imageUrls?.length > 0) {
                entryEl.createEl('img', {
                    attr: { 
                        src: entry.imageUrls[0], 
                        style: 'max-width: 50px; max-height: 50px; margin-top: 5px;'
                    }
                });
            }

            entryEl.addEventListener('click', () => onClick(entry));
        });
    }

    cleanup() {
        if (this.container) {
            this.container.empty();
            this.container = undefined;
        }
    }
}