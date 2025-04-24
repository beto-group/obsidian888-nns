import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type MyPlugin from '../../main';
import { providerFetchers, providerMetadata } from './providers/index';

export interface ProviderConfig {
	apiKey: string;
	model: string;
}

export interface MyPluginSettings {
	defaultProvider: string;
	backupProvider: string;
	providers: Record<string, ProviderConfig>;
}

// Dynamically generate DEFAULT_SETTINGS.providers from providerMetadata
export const DEFAULT_SETTINGS: MyPluginSettings = {
	defaultProvider: 'openai',
	backupProvider: 'local',
	providers: Object.keys(providerMetadata).reduce((acc, key) => {
		acc[key] = {
			apiKey: '',
			model: providerMetadata[key].defaultModel
		};
		return acc;
	}, {} as Record<string, ProviderConfig>)
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	selectedProviderKey: string;
	availableModels: string[] = [];
	workingProviders: Set<string> = new Set();

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.selectedProviderKey = plugin.settings.defaultProvider || Object.keys(providerMetadata)[0];
		this.ensureProviderConfigExists(this.selectedProviderKey);
	}

	ensureProviderConfigExists(providerKey: string): ProviderConfig | undefined {
		if (!this.plugin.settings.providers[providerKey] && providerMetadata[providerKey]) {
			this.plugin.settings.providers[providerKey] = {
				apiKey: '',
				model: providerMetadata[providerKey].defaultModel
			};
			console.log(`Added missing provider configuration for: ${providerKey}`);
		}
		return this.plugin.settings.providers[providerKey];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'LLM Provider Settings' });

		// Dropdowns for Default/Backup Providers
		const createProviderDropdown = (setting: Setting, settingKey: 'defaultProvider' | 'backupProvider') => {
			setting.addDropdown(dropdown => {
				const validProviders = Object.entries(this.plugin.settings.providers)
					.filter(([id, cfg]) =>
						(id === 'local' || cfg.apiKey) &&
						this.workingProviders.has(id)
					);

				dropdown.addOption('', '--- Select ---');
				if (validProviders.length === 0) {
					dropdown.addOption('', 'No validated providers available');
					dropdown.setDisabled(true);
				} else {
					validProviders.forEach(([id]) => dropdown.addOption(id, id));
					dropdown.setDisabled(false);
				}

				const currentValue = this.plugin.settings[settingKey];
				dropdown.setValue(validProviders.some(([id]) => id === currentValue) ? currentValue : '');

				dropdown.onChange(async value => {
					if (value === '') {
						new Notice(`Cleared ${settingKey === 'defaultProvider' ? 'Default' : 'Backup'} Provider.`);
					} else {
						new Notice(`${settingKey === 'defaultProvider' ? 'Default' : 'Backup'} provider set to ${value}`);
					}
					this.plugin.settings[settingKey] = value;
					await this.plugin.saveSettings();
				});
			});
		};

		const defaultProviderSetting = new Setting(containerEl)
			.setName('Default Provider')
			.setDesc('Primary provider (must be validated).');
		createProviderDropdown(defaultProviderSetting, 'defaultProvider');

		const backupProviderSetting = new Setting(containerEl)
			.setName('Backup Provider')
			.setDesc('Used if the default provider fails (must be validated).');
		createProviderDropdown(backupProviderSetting, 'backupProvider');

		containerEl.createEl('h3', { text: 'Configure Providers' });

		// Provider Selection Dropdown
		new Setting(containerEl)
			.setName('Select Provider to Configure')
			.setDesc('Choose a provider from the list to set its API key and model.')
			.addDropdown(dropdown => {
				Object.keys(providerMetadata).forEach(providerKey =>
					dropdown.addOption(providerKey, providerKey)
				);

				if (!providerMetadata[this.selectedProviderKey]) {
					this.selectedProviderKey = Object.keys(providerMetadata)[0];
				}

				dropdown.setValue(this.selectedProviderKey);

				dropdown.onChange(value => {
					this.selectedProviderKey = value;
					this.availableModels = [];
					this.ensureProviderConfigExists(this.selectedProviderKey);
					this.display();
				});
			});

		if (!this.selectedProviderKey || !providerMetadata[this.selectedProviderKey]) {
			containerEl.createEl('p', { text: 'Invalid provider selected.' });
			return;
		}

		const currentConfig = this.ensureProviderConfigExists(this.selectedProviderKey);
		if (!currentConfig) {
			containerEl.createEl('p', { text: `Configuration for ${this.selectedProviderKey} is missing.` });
			return;
		}

		containerEl.createEl('h4', { text: `Configure: ${this.selectedProviderKey}` });

		// API Key Input + Validation Button
		const apiKeySetting = new Setting(containerEl)
			.setName(`${this.selectedProviderKey} API Key`)
			.setDesc(`API key for ${this.selectedProviderKey}. Required for validation.`);

		if (!providerMetadata[this.selectedProviderKey].requiresApiKey) {
			apiKeySetting.setDesc(`'${this.selectedProviderKey}' provider does not require an API key.`);
		} else {
			apiKeySetting.addText(text => {
				text.setPlaceholder('Enter your API key')
					.setValue(currentConfig.apiKey)
					.onChange(async value => {
						currentConfig.apiKey = value.trim();
						this.workingProviders.delete(this.selectedProviderKey);
						this.availableModels = [];
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
				text.inputEl.style.width = '300px';
			});
		}

		apiKeySetting.addExtraButton(btn => {
			btn.setIcon('refresh-ccw')
				.setTooltip(`Validate ${this.selectedProviderKey} key & fetch models`)
				.onClick(async () => {
					if (providerMetadata[this.selectedProviderKey].requiresApiKey && !currentConfig.apiKey) {
						new Notice(`API Key required for ${this.selectedProviderKey}`, 5000);
						return;
					}
					new Notice(`Validating ${this.selectedProviderKey}...`);
					btn.setDisabled(true);

					const models = await this.fetchAvailableModels(this.selectedProviderKey, currentConfig.apiKey);

					if (models.length > 0) {
						this.availableModels = models;
						this.workingProviders.add(this.selectedProviderKey);
						new Notice(`${this.selectedProviderKey}: ${models.length} model(s) retrieved. Key validated!`, 5000);
						if (!models.includes(currentConfig.model)) {
							currentConfig.model = models[0];
							new Notice(`Model reset to ${models[0]} as previous was unavailable.`, 3000);
						}
						await this.plugin.saveSettings();
					} else {
						this.availableModels = [];
						this.workingProviders.delete(this.selectedProviderKey);
						new Notice(`${this.selectedProviderKey}: Validation failed. No models found or invalid API key.`, 5000);
					}
					btn.setDisabled(false);
					this.display();
				});

			if (this.workingProviders.has(this.selectedProviderKey)) {
				const statusSpan = btn.extraSettingsEl.createEl("span", { text: " ✅ Valid", cls: "setting-item-description" });
				if (statusSpan instanceof HTMLElement) {
					statusSpan.style.color = "green";
					statusSpan.style.marginLeft = "10px";
				}
			} else if (providerMetadata[this.selectedProviderKey].requiresApiKey && currentConfig.apiKey) {
				const statusSpan = btn.extraSettingsEl.createEl("span", { text: " ❓ Needs Validation", cls: "setting-item-description" });
				if (statusSpan instanceof HTMLElement) {
					statusSpan.style.color = "orange";
					statusSpan.style.marginLeft = "10px";
				}
			} else if (!providerMetadata[this.selectedProviderKey].requiresApiKey) {
				this.workingProviders.add(this.selectedProviderKey);
				const statusSpan = btn.extraSettingsEl.createEl("span", { text: " (N/A)", cls: "setting-item-description" });
				if (statusSpan instanceof HTMLElement) {
					statusSpan.style.color = "grey";
					statusSpan.style.marginLeft = "10px";
				}
			}
		});

		// Model Selection Dropdown
		const modelSetting = new Setting(containerEl)
			.setName(`${this.selectedProviderKey} Model`)
			.setDesc(`Select the model to use for ${this.selectedProviderKey}.`);

		modelSetting.addDropdown(dropdown => {
			const modelOptions = this.availableModels.length > 0
				? this.availableModels
				: (currentConfig.model ? [currentConfig.model] : [providerMetadata[this.selectedProviderKey].defaultModel]);

			if (modelOptions.length === 0 || (modelOptions.length === 1 && !modelOptions[0])) {
				dropdown.addOption('', 'No models available');
				dropdown.setDisabled(true);
			} else {
				modelOptions.forEach(m => dropdown.addOption(m, m));
				dropdown.setDisabled(false);
			}

			const currentModel = currentConfig.model;
			dropdown.setValue(modelOptions.includes(currentModel) ? currentModel : modelOptions[0] || '');

			dropdown.onChange(async value => {
				currentConfig.model = value;
				await this.plugin.saveSettings();
				new Notice(`${this.selectedProviderKey} model set to ${value}`);
			});
		});

		if (this.availableModels.length > 1) {
			containerEl.createEl('h5', { text: 'Available Models (fetched):' });
			const listEl = containerEl.createEl('ul', { cls: 'provider-model-list' });
			this.availableModels.forEach(model => {
				listEl.createEl('li', { text: model });
			});
		}

		if (this.plugin.settings.providers[this.selectedProviderKey]) {
			new Setting(containerEl)
				.setName(`Remove ${this.selectedProviderKey} Configuration`)
				.setDesc(`This will remove the API key and model selection for ${this.selectedProviderKey}. It can be re-configured later.`)
				.addButton(btn => {
					btn.setButtonText('Remove')
						.setIcon('trash')
						.setWarning()
						.onClick(async () => {
							const providerToDelete = this.selectedProviderKey;
							const wasDefault = this.plugin.settings.defaultProvider === providerToDelete;
							const wasBackup = this.plugin.settings.backupProvider === providerToDelete;

							delete this.plugin.settings.providers[providerToDelete];
							this.workingProviders.delete(providerToDelete);
							this.availableModels = [];

							if (wasDefault) this.plugin.settings.defaultProvider = '';
							if (wasBackup) this.plugin.settings.backupProvider = '';

							this.selectedProviderKey = Object.keys(this.plugin.settings.providers)[0]
								|| Object.keys(providerMetadata)[0];
							this.ensureProviderConfigExists(this.selectedProviderKey);

							await this.plugin.saveSettings();
							new Notice(`${providerToDelete} configuration removed.`);
							this.display();
						});
				});
		}
	}

	async fetchAvailableModels(providerKey: string, apiKey: string): Promise<string[]> {
		const fetcher = providerFetchers[providerKey];
		if (!fetcher) {
			new Notice(`Model fetching not implemented for provider: ${providerKey}`);
			return [];
		}
		try {
			const models = await fetcher(apiKey, this.plugin.app);
			return models;
		} catch (err) {
			console.error(`[${providerKey}] Model fetch error:`, err);
			new Notice(`Error fetching models for ${providerKey}: ${err.message}`, 5000);
			return [];
		}
	}
}