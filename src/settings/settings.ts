import { App, PluginSettingTab } from 'obsidian';
import type MyPlugin from '../../main';
import { SecretsManager } from '../utils/secrets';
import { validateAllStoredSecrets } from './validation';
import { renderCategoryTabs } from './components/CategoryTabs';
import { renderProviderSelector } from './components/ProviderSelector';
import { renderProviderConfig } from './components/ProviderConfig';
import { ensureProviderConfigExists } from './utils';
import { providerMetadata } from './providers/index';
import { DEFAULT_SETTINGS } from './defaults';

export class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    secrets: SecretsManager;
    selectedProviderKey: string;
    availableModels: Record<string, string[]> = {};
    workingProviders: Set<string> = new Set();
    isValidating: boolean = false;
    hasDoneInitialValidation: boolean = false;

    constructor(app: App, plugin: MyPlugin, secretsManager: SecretsManager) {
        super(app, plugin);
        this.plugin = plugin;
        this.secrets = secretsManager;

        // Initialize selected provider
        const firstCategory = 'text';
        const defaultProvider = this.plugin.settings.categories[firstCategory].defaultProvider;
        if (defaultProvider && providerMetadata[defaultProvider]) {
            this.selectedProviderKey = defaultProvider;
        } else if (Object.keys(providerMetadata).length > 0) {
            this.selectedProviderKey = Object.keys(providerMetadata)[0];
        } else {
            this.selectedProviderKey = '';
        }

        if (this.selectedProviderKey) {
            ensureProviderConfigExists(this, this.selectedProviderKey);
        }
    }

    async display(): Promise<void> {
        if (!this.hasDoneInitialValidation && !this.isValidating) {
            setTimeout(() => validateAllStoredSecrets(this), 0);
        }

        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'LLM Provider Settings' });

        // Render category tabs
        renderCategoryTabs(this, containerEl);

        containerEl.createEl('h3', { text: 'Configure Providers' });

        // Render provider selection dropdown
        renderProviderSelector(this, containerEl);

        // Render configuration for selected provider
        if (this.selectedProviderKey && providerMetadata[this.selectedProviderKey]) {
            renderProviderConfig(this, containerEl);
        } else {
            containerEl.createEl('p', { text: 'Please select a provider to configure.' });
        }
    }
}