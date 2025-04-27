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

// Common interface for history entries
export interface BaseHistoryEntry {
    provider: string;
    model: string;
    prompt: string;
    timestamp: string;
}

interface PromptHistoryEntry extends BaseHistoryEntry {
    output: string;
}

export interface ImageHistoryEntry extends BaseHistoryEntry {
    imageUrls: string[];
}

type HistoryEntry = PromptHistoryEntry | ImageHistoryEntry;

interface ConsoleTab {
    id: string;
    name: string;
    icon: string;
    render(container: HTMLElement): void;
    cleanup(): void;
    renderHistory?(history: HistoryEntry[]): void;
}

export class AiConsoleModal extends Modal {
    private settings: MyPluginSettings;
    private secrets: SecretsManager;
    private tabs: ConsoleTab[] = [];
    private tabComponent: TabComponent;
    private history: HistoryEntry[] = [];
    private maxHistoryEntries = 10;

    constructor(app: App, settings: MyPluginSettings, secrets: SecretsManager) {
        super(app);
        this.settings = settings;
        this.secrets = secrets;
        this.initializeTabs();
        const tabConfigs: TabConfig[] = this.tabs.map(tab => ({
            tab,
            icon: tab.icon
        }));
        this.tabComponent = new TabComponent(this.app, tabConfigs, 'text');
    }

    private initializeTabs() {
        this.tabs = [
            new TextConsoleTab(this.app, this.settings, this.secrets, this.addToHistory.bind(this), this.renderHistory.bind(this)),
            new ImageConsoleTab(this.app, this.settings, this.secrets, this.addToHistory.bind(this), this.renderHistory.bind(this)),
            new VideoConsoleTab(this.app, this.settings, this.secrets),
            new AudioConsoleTab(this.app, this.settings, this.secrets),
            new OcrConsoleTab(this.app, this.settings, this.secrets),
            new ThreeDConsoleTab(this.app, this.settings, this.secrets)
        ];
    }

    onOpen() {
        console.log('[AiConsoleModal] Opening modal...');
        this.titleEl.setText('AI Console Playground');
        this.contentEl.empty();
        const container = this.contentEl.createEl('div', { cls: 'ai-console-container' });
        this.tabComponent.render(container);
    }

    private addToHistory(entry: HistoryEntry) {
        this.history.unshift(entry);
        if (this.history.length > this.maxHistoryEntries) {
            this.history.pop();
        }
        this.renderHistory();
    }

    public renderHistory() {
        const activeTab = this.tabs.find(tab => tab.id === this.tabComponent.getActiveTabId());
        if (activeTab && activeTab.renderHistory) {
            activeTab.renderHistory(this.history);
        }
    }

    onClose() {
        this.tabComponent.cleanup();
        console.log('[AiConsoleModal] Modal closed.');
    }
}