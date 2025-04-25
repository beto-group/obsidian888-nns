// src/ui/console/sections/PromptHistory.ts
interface PromptHistoryEntry {
    provider: string;
    model: string;
    prompt: string;
    output: string;
    timestamp: string;
  }
  
  export class PromptHistory {
    private historyContainer: HTMLElement;
    private historyList: HTMLElement;
    private isHistoryVisible: boolean = true;
  
    render(container: HTMLElement, onClick: (entry: PromptHistoryEntry) => void) {
      this.historyContainer = container.createEl('div', { cls: 'ai-console-history' });
      const historyHeader = this.historyContainer.createEl('h4', { text: 'Recent Prompts ▼' });
      this.historyList = this.historyContainer.createEl('ul', { cls: 'ai-console-history-list' });
  
      historyHeader.addEventListener('click', () => {
        this.isHistoryVisible = !this.isHistoryVisible;
        this.historyList.style.display = this.isHistoryVisible ? 'block' : 'none';
        historyHeader.textContent = `Recent Prompts ${this.isHistoryVisible ? '▼' : '▲'}`;
      });
    }
  
    updateHistory(history: PromptHistoryEntry[], onClick: (entry: PromptHistoryEntry) => void) {
      this.historyList.empty();
      history.forEach(entry => {
        const li = this.historyList.createEl('li');
        li.createEl('strong', { text: `[${entry.timestamp}] ${entry.provider} (${entry.model})` });
        li.createEl('br');
        li.createEl('span', { text: `Prompt: ${entry.prompt}${entry.prompt.length > 50 ? '...' : ''}` });
        li.addEventListener('click', () => onClick(entry));
      });
    }
  
    cleanup() {
      this.historyContainer.empty();
    }
  }