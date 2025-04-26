import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type MyPlugin from '../../main';
import { providerFetchers, providerMetadata } from './providers/index';
import { SecretsManager } from '../utils/secrets';
import { TabComponent, TabConfig, Tab } from '../ui/components/TabComponent';

// Define categories for provider selection
export type Category = 'text' | 'image' | 'video' | 'audio' | 'ocr' | '3d';

// Define supported providers per category
const categoryProviders: Record<Category, string[]> = {
    text: ['openai', 'anthropic', 'groq', 'gemini', 'openrouter', 'grok', 'local'],
    image: ['openai', 'stabilityai', 'grok'],
    video: [], // No providers yet; placeholder for future
    audio: [], // No providers yet
    ocr: [], // No providers yet
    '3d': ['stabilityai'] // Added 3D category with stabilityai as a provider
};

export interface ProviderConfig {
    model: string;
}

export interface CategorySettings {
    defaultProvider: string;
    backupProvider: string;
}

export interface MyPluginSettings {
    categories: Record<Category, CategorySettings>;
    providers: Record<string, ProviderConfig>;
}

// Dynamically generate DEFAULT_SETTINGS
export const DEFAULT_SETTINGS: MyPluginSettings = {
    categories: {
        text: { defaultProvider: 'openai', backupProvider: '' },
        image: { defaultProvider: 'openai', backupProvider: '' },
        video: { defaultProvider: '', backupProvider: '' },
        audio: { defaultProvider: '', backupProvider: '' },
        ocr: { defaultProvider: '', backupProvider: '' },
        '3d': { defaultProvider: '', backupProvider: '' } // Added 3D category
    },
    providers: Object.keys(providerMetadata).reduce((acc, key) => {
        acc[key] = {
            model: providerMetadata[key].defaultModel
        };
        return acc;
    }, {} as Record<string, ProviderConfig>)
};

export class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    secrets: SecretsManager;
    selectedProviderKey: string;
    availableModels: Record<string, string[]> = {};
    workingProviders: Set<string> = new Set();
    isValidating: boolean = false;
    hasDoneInitialValidation: boolean = false;
    tabComponent: TabComponent | null = null;

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
            this.ensureProviderConfigExists(this.selectedProviderKey);
        }
    }

    private async validateAllStoredSecrets(): Promise<void> {
        if (this.isValidating) return;
        this.isValidating = true;
        console.log("[Settings] Starting initial validation of all stored secrets...");

        this.workingProviders.clear();
        this.availableModels = {};

        let storedKeys: string[] = [];
        try {
            storedKeys = await this.secrets.listSecrets();
            console.log("[Settings] Stored secret keys found:", storedKeys);
        } catch (error) {
            console.error("[Settings] Failed to list secrets during validation:", error);
            this.isValidating = false;
            return;
        }

        let settingsChanged = false;

        const validationPromises = Object.keys(providerMetadata).map(async (providerKey) => {
            const meta = providerMetadata[providerKey];
            const requiresApiKey = meta.requiresApiKey;
            const hasStoredSecret = storedKeys.includes(providerKey);

            this.ensureProviderConfigExists(providerKey);

            if (!requiresApiKey) {
                this.workingProviders.add(providerKey);
                console.log(`[Settings] Added non-API-key provider: ${providerKey}`);
                try {
                    const models = await this.fetchAvailableModels(providerKey, undefined);
                    this.availableModels[providerKey] = models;
                    if (models.length > 0) {
                        const currentModel = this.plugin.settings.providers[providerKey]?.model;
                        if (!currentModel || !models.includes(currentModel)) {
                            console.log(`[Settings] Resetting model for ${providerKey} to ${models[0]}`);
                            this.plugin.settings.providers[providerKey].model = models[0];
                            settingsChanged = true;
                        }
                    } else {
                        console.warn(`[Settings] No models found for non-API-key provider: ${providerKey}`);
                    }
                } catch (error) {
                    console.error(`[Settings] Error fetching models for non-API-key provider ${providerKey}:`, error);
                    this.availableModels[providerKey] = [];
                }
                return;
            }

            if (hasStoredSecret) {
                let apiKey: string | undefined;
                try {
                    apiKey = await this.secrets.getSecret(providerKey);
                } catch (error) {
                    console.error(`[Settings] Failed to get secret for ${providerKey}:`, error);
                    return;
                }

                if (apiKey) {
                    console.log(`[Settings] Auto-validating stored secret for: ${providerKey}`);
                    try {
                        const models = await this.fetchAvailableModels(providerKey, apiKey);
                        this.availableModels[providerKey] = models;

                        if (models.length > 0) {
                            this.workingProviders.add(providerKey);
                            const currentModel = this.plugin.settings.providers[providerKey]?.model;
                            if (!currentModel || !models.includes(currentModel)) {
                                console.log(`[Settings] Resetting model for ${providerKey} to ${models[0]}`);
                                this.plugin.settings.providers[providerKey].model = models[0];
                                settingsChanged = true;
                            }
                            console.log(`[Settings] Auto-validation successful for: ${providerKey}`);
                        } else {
                            console.log(`[Settings] Auto-validation failed for stored secret: ${providerKey}. Needs manual re-validation.`);
                        }
                    } catch (error) {
                        console.error(`[Settings] Auto-validation model fetch error for ${providerKey}:`, error);
                        this.availableModels[providerKey] = [];
                    }
                } else {
                    console.warn(`[Settings] Secret listed for ${providerKey} but getSecret returned undefined.`);
                    this.availableModels[providerKey] = [];
                }
            } else {
                console.log(`[Settings] No stored secret found for API key provider: ${providerKey}`);
                this.availableModels[providerKey] = [];
            }
        });

        await Promise.all(validationPromises);

        if (settingsChanged) {
            await this.plugin.saveSettings();
        }

        this.isValidating = false;
        this.hasDoneInitialValidation = true;
        console.log("[Settings] Finished initial validation. Working providers:", Array.from(this.workingProviders));

        this.display();
    }

    ensureProviderConfigExists(providerKey: string): ProviderConfig | undefined {
        if (!providerKey) return undefined;

        const meta = providerMetadata[providerKey];
        if (!meta) {
            console.error(`[Settings] No metadata found for provider key: ${providerKey}`);
            return undefined;
        }

        if (!this.plugin.settings.providers[providerKey]) {
            this.plugin.settings.providers[providerKey] = {
                model: meta.defaultModel
            };
            console.log(`[Settings] Added missing provider configuration for: ${providerKey}`);
        }
        return this.plugin.settings.providers[providerKey];
    }

    async display(): Promise<void> {
        if (!this.hasDoneInitialValidation && !this.isValidating) {
            setTimeout(() => this.validateAllStoredSecrets(), 0);
        }

        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'LLM Provider Settings' });

        // --- Category-based Provider Selection with Tabs ---
        const tabs: TabConfig[] = Object.keys(categoryProviders).map(category => ({
            tab: {
                id: category,
                name: category.charAt(0).toUpperCase() + category.slice(1),
                render: (tabContainer: HTMLElement) => this.renderCategoryTab(tabContainer, category as Category),
                cleanup: () => {} // No cleanup needed for static settings
            },
            icon: this.getTabIcon(category)
        }));

        this.tabComponent = new TabComponent(this.app, tabs, 'text');
        const tabContainer = containerEl.createEl('div', { cls: 'category-tabs' });
        this.tabComponent.render(tabContainer);

        containerEl.createEl('h3', { text: 'Configure Providers' });

        // --- Provider Selection Dropdown ---
        new Setting(containerEl)
            .setName('Select Provider to Configure')
            .setDesc('Choose a provider to set its API key (if required) and model.')
            .addDropdown(dropdown => {
                Object.keys(providerMetadata).forEach(providerKey =>
                    dropdown.addOption(providerKey, providerKey)
                );

                if (!providerMetadata[this.selectedProviderKey]) {
                    this.selectedProviderKey = Object.keys(providerMetadata)[0] || '';
                }

                dropdown.setValue(this.selectedProviderKey);

                dropdown.onChange(value => {
                    this.selectedProviderKey = value;
                    this.ensureProviderConfigExists(this.selectedProviderKey);
                    this.display();
                });
            });

        // --- Configuration Section for Selected Provider ---
        if (!this.selectedProviderKey || !providerMetadata[this.selectedProviderKey]) {
            containerEl.createEl('p', { text: 'Please select a provider to configure.' });
            return;
        }

        const selectedMeta = providerMetadata[this.selectedProviderKey];
        const currentConfig = this.ensureProviderConfigExists(this.selectedProviderKey);
        if (!currentConfig) {
            containerEl.createEl('p', { text: `Error: Configuration could not be created for ${this.selectedProviderKey}.` });
            return;
        }

        containerEl.createEl('h4', { text: `Configure: ${selectedMeta.key}` });

        // --- API Key Input + Validation Button ---
        const apiKeySetting = new Setting(containerEl);
        const requiresApiKey = selectedMeta.requiresApiKey;

        apiKeySetting.setName(`${selectedMeta.key} API Key`)
            .setDesc(requiresApiKey
                ? `Enter/update key and click Validate.`
                : `This provider does not require an API key.`);

        let apiKeyInput: HTMLInputElement | null = null;

        if (requiresApiKey) {
            apiKeySetting.addText(text => {
                apiKeyInput = text.inputEl;
                text.setPlaceholder('Enter API key here')
                    .setValue('')
                    .onChange(async value => {});
                text.inputEl.type = 'password';
                text.inputEl.style.width = '300px';
            });
        }

        apiKeySetting.addExtraButton(btn => {
            btn.setIcon('refresh-ccw')
                .setTooltip(requiresApiKey
                    ? `Validate ${selectedMeta.key} key & fetch models`
                    : 'Fetch available models (no API key needed)')
                .onClick(async () => {
                    let apiKeyToValidate: string | undefined = undefined;
                    const currentProvider = this.selectedProviderKey;

                    if (requiresApiKey) {
                        if (!apiKeyInput) return;
                        apiKeyToValidate = apiKeyInput.value.trim();
                        if (!apiKeyToValidate) {
                            apiKeyToValidate = await this.secrets.getSecret(currentProvider);
                            if (!apiKeyToValidate) {
                                new Notice(`API Key required for ${currentProvider}. Enter one or check storage.`, 5000);
                                return;
                            }
                            new Notice(`Re-validating stored key for ${currentProvider}...`);
                        } else {
                            new Notice(`Validating new key for ${currentProvider}...`);
                            await this.secrets.setSecret(currentProvider, apiKeyToValidate);
                            console.log(`[Settings] Saved new API key for ${currentProvider} before validation.`);
                        }
                    } else {
                        new Notice(`Fetching models for ${currentProvider}...`);
                    }

                    btn.setDisabled(true);
                    this.workingProviders.delete(currentProvider);

                    try {
                        const models = await this.fetchAvailableModels(currentProvider, apiKeyToValidate);
                        this.availableModels[currentProvider] = models;

                        if (models.length > 0) {
                            this.workingProviders.add(currentProvider);
                            new Notice(`${currentProvider}: ${models.length} model(s) found. ${requiresApiKey ? 'Key validated!' : 'Models fetched!'}`, 5000);

                            const config = this.ensureProviderConfigExists(currentProvider);
                            if (config && (!models.includes(config.model))) {
                                config.model = models[0];
                                new Notice(`Model reset to ${models[0]} as previous was unavailable.`, 3000);
                                await this.plugin.saveSettings();
                            }
                        } else {
                            new Notice(`${currentProvider}: Validation failed. No models found${requiresApiKey ? ' or invalid API key' : ''}. Check console.`, 5000);
                        }
                    } catch (error) {
                        console.error(`[Settings] Manual validation error for ${currentProvider}:`, error);
                        this.availableModels[currentProvider] = [];
                        new Notice(`${currentProvider}: Validation failed. ${error.message}`, 7000);
                    } finally {
                        btn.setDisabled(false);
                        this.display();
                    }
                });

            const statusContainer = btn.extraSettingsEl.createSpan({ cls: "setting-item-description" });
            statusContainer.style.marginLeft = "10px";

            if (this.workingProviders.has(this.selectedProviderKey)) {
                statusContainer.setText("✅ Valid");
                statusContainer.style.color = "green";
            } else if (requiresApiKey) {
                this.secrets.getSecret(this.selectedProviderKey).then(storedKey => {
                    if (this.selectedProviderKey === selectedMeta.key) {
                        if (storedKey) {
                            statusContainer.setText("❓ Validation Needed / Failed");
                            statusContainer.style.color = "orange";
                        } else {
                            statusContainer.setText("❌ No Key Set");
                            statusContainer.style.color = "red";
                        }
                    }
                }).catch(err => {
                    console.error("Error checking secret for status:", err);
                    statusContainer.setText("⚠️ Error checking key");
                    statusContainer.style.color = "red";
                });
            } else {
                if (this.availableModels[this.selectedProviderKey]?.length > 0) {
                    statusContainer.setText("✅ Models Fetched");
                    statusContainer.style.color = "green";
                } else {
                    statusContainer.setText("❓ Fetch Models");
                    statusContainer.style.color = "orange";
                }
            }
        });

        // --- Model Selection Dropdown ---
        const modelSetting = new Setting(containerEl)
            .setName(`${selectedMeta.key} Model`)
            .setDesc(`Select the model for ${selectedMeta.key}. (List updated after validation)`);

        modelSetting.addDropdown(dropdown => {
            const modelOptions = this.availableModels[this.selectedProviderKey] ?? [];
            const defaultModel = selectedMeta.defaultModel;
            let optionsToShow = [...modelOptions];

            const currentSelectedModel = currentConfig.model;
            if (currentSelectedModel && !optionsToShow.includes(currentSelectedModel)) {
                optionsToShow.push(currentSelectedModel);
            }
            if (optionsToShow.length === 0 && defaultModel) {
                optionsToShow.push(defaultModel);
            }

            optionsToShow.sort();

            if (optionsToShow.length === 0) {
                dropdown.addOption('', 'No models available (Validate key/Fetch first)');
                dropdown.setDisabled(true);
            } else {
                optionsToShow.forEach(m => dropdown.addOption(m, m));
                dropdown.setDisabled(false);
            }

            dropdown.setValue(optionsToShow.includes(currentSelectedModel) ? currentSelectedModel : optionsToShow[0] || '');

            dropdown.onChange(async value => {
                currentConfig.model = value;
                await this.plugin.saveSettings();
                new Notice(`${selectedMeta.key} model set to ${value}`);
            });
        });

        // --- Display Fetched Models ---
        const currentModels = this.availableModels[this.selectedProviderKey] ?? [];
        if (currentModels.length > 0) {
            const detailsEl = containerEl.createEl('details');
            detailsEl.createEl('summary', { text: `View ${currentModels.length} Available Models` });
            const listEl = detailsEl.createEl('ul', { cls: 'provider-model-list' });
            const modelsToShow = currentModels.slice(0, 25);
            modelsToShow.forEach(model => {
                listEl.createEl('li', { text: model });
            });
            if (currentModels.length > 25) {
                listEl.createEl('li', { text: `... and ${currentModels.length - 25} more.` });
            }
        }

        // --- Remove Configuration Button ---
        this.secrets.getSecret(this.selectedProviderKey).then(storedKey => {
            if (this.selectedProviderKey === selectedMeta.key && storedKey) {
                new Setting(containerEl)
                    .setName(`Remove ${selectedMeta.key} API Key`)
                    .setDesc(`Removes the stored API key for ${selectedMeta.key}. The model selection will be kept.`)
                    .addButton(btn => {
                        btn.setButtonText('Remove Key')
                            .setIcon('trash')
                            .setWarning()
                            .onClick(async () => {
                                const providerToDelete = this.selectedProviderKey;
                                new Notice(`Removing API key for ${providerToDelete}...`);

                                await this.secrets.deleteSecret(providerToDelete);

                                this.workingProviders.delete(providerToDelete);
                                this.availableModels[providerToDelete] = [];

                                // Reset default/backup providers for affected categories
                                Object.keys(this.plugin.settings.categories).forEach(category => {
                                    const catSettings = this.plugin.settings.categories[category as Category];
                                    if (catSettings.defaultProvider === providerToDelete) {
                                        catSettings.defaultProvider = '';
                                        new Notice(`Default provider for ${category} cleared as its key was removed.`, 3000);
                                    }
                                    if (catSettings.backupProvider === providerToDelete) {
                                        catSettings.backupProvider = '';
                                        new Notice(`Backup provider for ${category} cleared as its key was removed.`, 3000);
                                    }
                                });

                                await this.plugin.saveSettings();
                                new Notice(`${providerToDelete} API key removed.`);

                                this.display();
                            });
                    });
            }
        }).catch(err => console.error("Error checking secret for remove button:", err));
    }

    private renderCategoryTab(container: HTMLElement, category: Category) {
        const catSettings = this.plugin.settings.categories[category] || {
            defaultProvider: '',
            backupProvider: ''
        };

        // Create settings for default and backup providers
        const createProviderDropdown = (setting: Setting, settingKey: 'defaultProvider' | 'backupProvider') => {
            setting.addDropdown(dropdown => {
                const validProviders = categoryProviders[category]
                    .filter(id => this.workingProviders.has(id));

                dropdown.addOption('', '--- Select ---');

                if (validProviders.length === 0) {
                    dropdown.addOption('', 'No validated providers available');
                    dropdown.setDisabled(true);
                } else {
                    validProviders.forEach(id => dropdown.addOption(id, id));
                    dropdown.setDisabled(false);
                }

                const currentValue = catSettings[settingKey];
                dropdown.setValue(validProviders.includes(currentValue) ? currentValue : '');

                dropdown.onChange(async value => {
                    const settingName = settingKey === 'defaultProvider' ? 'Default' : 'Backup';
                    if (value === '') {
                        new Notice(`Cleared ${settingName} Provider for ${category}.`);
                    } else {
                        new Notice(`${settingName} provider for ${category} set to ${value}`);
                    }
                    catSettings[settingKey] = value;
                    await this.plugin.saveSettings();
                });
            });
        };

        const defaultProviderSetting = new Setting(container)
            .setName(`Default Provider for ${category}`)
            .setDesc(`Primary provider for ${category} (must be validated).`);
        createProviderDropdown(defaultProviderSetting, 'defaultProvider');

        const backupProviderSetting = new Setting(container)
            .setName(`Backup Provider for ${category}`)
            .setDesc(`Used if the default provider for ${category} fails (must be validated).`);
        createProviderDropdown(backupProviderSetting, 'backupProvider');
    }

    private getTabIcon(category: string): string {
        const tabIcons: Record<string, string> = {
            text: 'text',
            image: 'image',
            video: 'video',
            audio: 'volume-2',
            ocr: 'scan',
            '3d': 'cube' // Already defined, should work fine
        };
        return tabIcons[category] || 'circle';
    }

    async fetchAvailableModels(providerKey: string, apiKey: string | undefined): Promise<string[]> {
        const fetcher = providerFetchers[providerKey];
        const meta = providerMetadata[providerKey];

        if (!meta) {
            console.error(`[Settings] No metadata found for provider: ${providerKey}`);
            return [];
        }
        if (meta.requiresApiKey && !apiKey) {
            console.warn(`[Settings] fetchAvailableModels called for ${providerKey} which requires an API key, but none was provided.`);
            return [];
        }
        if (!fetcher) {
            new Notice(`Model fetching not implemented for provider: ${providerKey}`);
            console.warn(`Model fetching not implemented for provider: ${providerKey}`);
            return [];
        }

        try {
            const models = await fetcher(apiKey || '', this.plugin.app);
            return Array.isArray(models) ? models : [];
        } catch (err) {
            console.error(`[${providerKey}] Model fetch error during fetchAvailableModels:`, err);
            throw err;
        }
    }
}