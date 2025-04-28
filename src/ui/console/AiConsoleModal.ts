import { App, Modal, Notice } from 'obsidian';
import type { MyPluginSettings } from '../../settings/types';
import type { SecretsManager } from '../../utils/secrets';
import { TextConsoleTab } from './tabs/TextConsoleTab';
import { ImageConsoleTab } from './tabs/ImageConsoleTab';
import { VideoConsoleTab } from './tabs/VideoConsoleTab';
import { AudioConsoleTab } from './tabs/AudioConsoleTab';
import { OcrConsoleTab } from './tabs/OcrConsoleTab';
import { ThreeDConsoleTab } from './tabs/ThreeDConsoleTab';
import { TabComponent, TabConfig } from '../components/TabComponent';
import { HistoryManager, BaseHistoryEntry, PromptHistoryEntry, ImageHistoryEntry, HistoryType } from '../../utils/historyManager';

export class AiConsoleModal extends Modal {
  private settings: MyPluginSettings;
  private secrets: SecretsManager;
  private tabs: ConsoleTab[] = [];
  private tabComponent: TabComponent;
  private historyManager: HistoryManager;
  private maxHistoryEntries = 10;

  constructor(app: App, settings: MyPluginSettings, secrets: SecretsManager) {
    super(app);
    this.settings = settings;
    this.secrets = secrets;
    this.historyManager = new HistoryManager(app, secrets);
    console.log('[AiConsoleModal] Constructor - historyManager:', this.historyManager);
    this.initializeTabs();
    const tabConfigs: TabConfig[] = this.tabs.map(tab => ({
      tab,
      icon: tab.icon,
    }));
    this.tabComponent = new TabComponent(this.app, tabConfigs, 'text', (tabId: string) => {
      this.renderHistory(); // Trigger history rendering on tab change
    });
  }

  private initializeTabs() {
    console.log('[AiConsoleModal] Initializing tabs');
    this.tabs = [
      new TextConsoleTab(this.app, this.settings, this.secrets, this.addToHistory.bind(this)),
      new ImageConsoleTab(this.app, this.settings, this.secrets, this.addToHistory.bind(this)),
      new VideoConsoleTab(this.app, this.settings, this.secrets),
      new AudioConsoleTab(this.app, this.settings, this.secrets),
      new OcrConsoleTab(this.app, this.settings, this.secrets),
      new ThreeDConsoleTab(this.app, this.settings, this.secrets),
    ];
  }

  onOpen() {
    console.log('[AiConsoleModal] Opening modal...');
    this.titleEl.setText('AI Console Playground');
    this.contentEl.empty();
    const container = this.contentEl.createEl('div', { cls: 'ai-console-container' });
    this.tabComponent.render(container);
    this.renderHistory(); // Load and render history for initial tab
  }

  private async addToHistory<T extends BaseHistoryEntry>(entry: T) {
    const activeTabId = this.tabComponent.getActiveTabId() as HistoryType;
    console.log('[AiConsoleModal] Adding to history for tab:', activeTabId, 'entry:', entry);
    try {
      await this.historyManager.addEntry<T>(activeTabId, entry, this.maxHistoryEntries);
      await this.renderHistory(); // Refresh history after adding
    } catch (error) {
      console.error('[AiConsoleModal] Failed to add history entry for', activeTabId, ':', error);
      new Notice(`Failed to save ${activeTabId} history.`);
    }
  }

  public async renderHistory() {
    const activeTabId = this.tabComponent.getActiveTabId() as HistoryType;
    console.log('[AiConsoleModal] Rendering history for tab:', activeTabId);
    const activeTab = this.tabs.find(tab => tab.id === activeTabId);
    if (activeTab && 'renderHistory' in activeTab && activeTab.renderHistory) {
      try {
        const history = await this.historyManager.loadHistory<BaseHistoryEntry>(activeTabId);
        console.log('[AiConsoleModal] History loaded for', activeTabId, ':', history);
        activeTab.renderHistory(history);
      } catch (error) {
        console.error('[AiConsoleModal] Failed to load history for', activeTabId, ':', error);
        new Notice(`Failed to load ${activeTabId} history.`);
        activeTab.renderHistory([]); // Render empty history as fallback
      }
    }
  }

  onClose() {
    this.tabComponent.cleanup();
    console.log('[AiConsoleModal] Modal closed.');
  }
}

interface ConsoleTab {
  id: string;
  name: string;
  icon: string;
  render(container: HTMLElement): void;
  cleanup(): void;
  renderHistory?(history: BaseHistoryEntry[]): void;
}