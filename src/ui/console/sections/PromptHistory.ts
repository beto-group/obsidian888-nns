import { App, Notice } from 'obsidian';
import type { PromptHistoryEntry, ImageHistoryEntry } from '../../../utils/historyManager';

type HistoryEntry = PromptHistoryEntry | ImageHistoryEntry;

export class PromptHistory {
  private history: HistoryEntry[] = [];
  private container?: HTMLElement;
  private clickHandler?: (entry: HistoryEntry) => void;

  render(container: HTMLElement, clickHandler: (entry: HistoryEntry) => void) {
    console.log('[PromptHistory] Rendering...');
    this.container = container;
    this.clickHandler = clickHandler;

    const historySection = this.container.createEl('div', { cls: 'ai-console-history-section' });
    historySection.createEl('h4', { text: 'Prompt History' });

    const styleEl = this.container.createEl('style');
    styleEl.textContent = `
      .ai-console-history-section {
        margin-top: 16px;
      }
      .ai-console-history-entry {
        padding: 8px;
        margin-bottom: 8px;
        background-color: #2f2f2f;
        border-radius: 4px;
        cursor: pointer;
        position: relative;
      }
      .ai-console-history-entry:hover {
        background-color: #3f3f3f;
      }
      .ai-console-history-copy-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ai-console-history-copy-btn svg {
        width: 16px;
        height: 16px;
        stroke: #ffffff;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
      }
      .ai-console-history-copy-btn:hover svg {
        stroke: #cccccc;
      }
      .ai-console-history-images {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .ai-console-history-image {
        max-width: 50px;
        max-height: 50px;
        border-radius: 4px;
      }
      .ai-console-history-prompt {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0;
        padding-right: 30px; /* Ensure space for the copy button */
      }
    `;

    this.updateHistory(this.history, this.clickHandler);
  }

  updateHistory(history: HistoryEntry[], clickHandler: (entry: HistoryEntry) => void) {
    console.log('[PromptHistory] Updating history:', history);
    this.history = history;
    this.clickHandler = clickHandler;

    if (!this.container) {
      console.warn('[PromptHistory] Container not initialized.');
      return;
    }

    const historySection = this.container.querySelector('.ai-console-history-section');
    if (!historySection) {
      console.warn('[PromptHistory] History section not found.');
      return;
    }

    // Clear existing entries
    historySection.innerHTML = '';
    historySection.createEl('h4', { text: 'Prompt History' });

    this.history.forEach((entry, index) => {
      const entryEl = historySection.createEl('div', { cls: 'ai-console-history-entry' });
      // Add the prompt with truncation
      entryEl.createEl('p', { cls: 'ai-console-history-prompt', text: `Prompt: ${entry.prompt}` });
      entryEl.createEl('p', { text: `Provider: ${entry.provider} | Model: ${entry.model}` });
      entryEl.createEl('p', { text: `Time: ${entry.timestamp}` });

      // Add copy button with Lucide "Copy" icon
      const copyBtn = entryEl.createEl('button', { cls: 'ai-console-history-copy-btn' });
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      `;
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(entry, null, 2)).then(() => {
          new Notice('History entry copied to clipboard.');
        }).catch(err => {
          console.error('[PromptHistory] Failed to copy entry:', err);
          new Notice('Failed to copy history entry.');
        });
      });

      // For ImageHistoryEntry, display a preview of images
      if ('imageUrls' in entry && entry.imageUrls?.length > 0) {
        const imageContainer = entryEl.createEl('div', { cls: 'ai-console-history-images' });
        entry.imageUrls.forEach((base64, imgIndex) => {
          try {
            const mimeType = `image/${entry.output_format || 'png'}`;
            const dataUrl = `data:${mimeType};base64,${base64}`;
            const img = imageContainer.createEl('img', {
              cls: 'ai-console-history-image',
              attr: { src: dataUrl },
            });
            img.onerror = () => {
              img.remove();
              imageContainer.createEl('p', { text: `Failed to load image ${imgIndex + 1}.` });
            };
          } catch (e) {
            console.error('[PromptHistory] Failed to render history image:', e);
            imageContainer.createEl('p', { text: `Failed to render image ${imgIndex + 1}.` });
          }
        });
      }

      // Add click handler for the entire entry
      entryEl.addEventListener('click', () => {
        if (this.clickHandler) {
          this.clickHandler(entry);
        }
      });
    });
  }

  cleanup() {
    if (this.container) {
      this.container.empty();
      this.container = undefined;
    }
    this.clickHandler = undefined;
    this.history = [];
  }
}