import { App, Modal, Notice, setIcon } from 'obsidian';
import type { MyPluginSettings } from '../../settings/settings';
import type { SecretsManager } from '../../utils/secrets';
import { TextConsoleTab } from './tabs/TextConsoleTab';
import { ImageConsoleTab } from './tabs/ImageConsoleTab';
import { VideoConsoleTab } from './tabs/VideoConsoleTab';
import { AudioConsoleTab } from './tabs/AudioConsoleTab';
import { OcrConsoleTab } from './tabs/OcrConsoleTab';
import { consoleCSS } from './styles/consoleStyles'; // 🔥 Make sure your build supports this

interface PromptHistoryEntry {
  provider: string;
  model: string;
  prompt: string;
  output: string;
  timestamp: string;
}

interface ConsoleTab {
  id: string;
  name: string;
  render(container: HTMLElement): void;
  cleanup(): void;
  renderHistory?(history: PromptHistoryEntry[]): void;
}

export class AiConsoleModal extends Modal {
  private settings: MyPluginSettings;
  private secrets: SecretsManager;
  private tabs: ConsoleTab[] = [];
  private activeTab: string = 'text';
  private container: HTMLElement;
  private history: PromptHistoryEntry[] = [];
  private maxHistoryEntries = 10;

  constructor(app: App, settings: MyPluginSettings, secrets: SecretsManager) {
    super(app);
    this.settings = settings;
    this.secrets = secrets;
    this.initializeTabs();
  }

  private initializeTabs() {
    this.tabs = [
      new TextConsoleTab(this.app, this.settings, this.secrets, this.addToHistory.bind(this), this.renderHistory.bind(this)),
      new ImageConsoleTab(this.app, this.settings, this.secrets),
      new VideoConsoleTab(this.app, this.settings, this.secrets),
      new AudioConsoleTab(this.app, this.settings, this.secrets),
      new OcrConsoleTab(this.app, this.settings, this.secrets),
    ];
  }

  onOpen() {
    console.log('[AiConsoleModal] Opening modal...');
    this.titleEl.setText('AI Console Playground');
    this.contentEl.empty();
    this.container = this.contentEl.createEl('div', { cls: 'ai-console-container' });

    // 🔥 Inject CSS as string into <head>
    const style = document.createElement('style');
    style.textContent = consoleCSS;
    document.head.appendChild(style);

    this.renderActiveTab();
  }

  private switchTab(tabId: string) {
    this.activeTab = tabId;
    this.renderActiveTab();
  }

  private renderActiveTab() {
    this.container.empty();

    const tabIcons: Record<string, string> = {
      text: 'file-text',
      image: 'image',
      video: 'video',
      audio: 'volume-2',
      ocr: 'scan'
    };

    const tabSelector = this.container.createEl('div', { cls: 'ai-console-tab-selector' });

    this.tabs.forEach(tab => {
      const isActive = tab.id === this.activeTab;
      const tabButton = tabSelector.createEl('button', {
        cls: `ai-console-tab-button${isActive ? ' active' : ''}`
      });

      const iconName = tabIcons[tab.id];
      if (iconName) {
        const iconEl = tabButton.createEl('span', { cls: 'ai-console-tab-icon' });
        setIcon(iconEl, iconName);
      }

      tabButton.createSpan({ cls: 'ai-console-tab-label', text: tab.name.split(' ')[0] });
      tabButton.addEventListener('click', () => this.switchTab(tab.id));
    });

    const content = this.container.createEl('div', { cls: 'ai-console-tab-content' });
    const active = this.tabs.find(t => t.id === this.activeTab);
    if (active) active.render(content);
  }

  private addToHistory(entry: PromptHistoryEntry) {
    this.history.unshift(entry);
    if (this.history.length > this.maxHistoryEntries) {
      this.history.pop();
    }
    this.renderHistory();
  }

  public renderHistory() {
    const activeTab = this.tabs.find(tab => tab.id === this.activeTab);
    if (activeTab && activeTab.renderHistory) {
      activeTab.renderHistory(this.history);
    }
  }

  onClose() {
    this.tabs.forEach(tab => tab.cleanup());
    this.container.empty();
    console.log('[AiConsoleModal] Modal closed.');
  }
}
