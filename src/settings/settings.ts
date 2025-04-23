import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type MyPlugin from '../../main'; // Assuming MyPlugin is correctly imported

export interface ProviderConfig {
	apiKey: string;
	model: string;
}

export interface MyPluginSettings {
	defaultProvider: string;
	backupProvider: string;
	providers: Record<string, ProviderConfig>;
}

// Keep DEFAULT_SETTINGS as the source of truth for all possible providers
export const DEFAULT_SETTINGS: MyPluginSettings = {
	defaultProvider: 'openai',
	backupProvider: 'local',
	providers: {
		openai: { apiKey: '', model: 'gpt-3.5-turbo' },
		local: { apiKey: '', model: 'llama2' },
		anthropic: { apiKey: '', model: 'claude-3-opus-20240229' },
		groq: { apiKey: '', model: 'mixtral-8x7b-32768' },
		gemini: { apiKey: '', model: 'models/gemini-pro' },
		openrouter: { apiKey: '', model: 'openrouter/google/gemma-7b-it' },
		grok: { apiKey: '', model: 'grok-3-beta' } // Corrected provider name based on fetch logic
		// Add any other potential providers here
	}
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	// Store the provider key currently being configured
	selectedProviderKey = '';
	// Store models fetched for the selected provider
	availableModels: string[] = [];
	// Keep track of providers with validated API keys in this session
	workingProviders: Set<string> = new Set();

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		// Initialize selectedProviderKey on creation, fallback needed if default doesn't exist
		this.selectedProviderKey = plugin.settings.defaultProvider || Object.keys(DEFAULT_SETTINGS.providers)[0];
		// Ensure the initially selected provider exists in settings
		this.ensureProviderConfigExists(this.selectedProviderKey);
	}

	// Helper function to ensure a provider config exists in settings
	ensureProviderConfigExists(providerKey: string): ProviderConfig | undefined {
		if (!this.plugin.settings.providers[providerKey] && DEFAULT_SETTINGS.providers[providerKey]) {
			// If provider exists in defaults but not in current settings, add it.
			// Use a shallow copy to avoid modifying DEFAULT_SETTINGS directly
			this.plugin.settings.providers[providerKey] = { ...DEFAULT_SETTINGS.providers[providerKey] };
			console.log(`Added missing provider configuration for: ${providerKey}`);
			// No need to save settings here, will happen on change or refresh
		}
		return this.plugin.settings.providers[providerKey];
	}


	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'LLM Provider Settings' });

		// --- Dropdowns for Default/Backup ---
		// These should only list providers that are configured AND validated
		const createProviderDropdown = (setting: Setting, settingKey: 'defaultProvider' | 'backupProvider') => {
			setting.addDropdown(dropdown => {
				// Filter providers: must exist in settings, have an API key (unless 'local'), and be validated (in workingProviders)
				const validProviders = Object.entries(this.plugin.settings.providers)
					.filter(([id, cfg]) =>
						(id === 'local' || cfg.apiKey) && // Local doesn't need an API key, others do
						this.workingProviders.has(id) // Must have been validated
					);

				dropdown.addOption('', '--- Select ---'); // Add a default blank option

				if (validProviders.length === 0) {
					dropdown.addOption('', 'No validated providers available');
					dropdown.setDisabled(true);
				} else {
					validProviders.forEach(([id]) => dropdown.addOption(id, id));
					dropdown.setDisabled(false);
				}

				// Set the current value, defaulting to '' if not found/valid
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
					// Re-display might not be necessary unless validation status changes affect dropdowns
				});
			});
		}

		const defaultProviderSetting = new Setting(containerEl)
			.setName('Default Provider')
			.setDesc('Primary provider (must be validated).');
		createProviderDropdown(defaultProviderSetting, 'defaultProvider');

		const backupProviderSetting = new Setting(containerEl)
			.setName('Backup Provider')
			.setDesc('Used if the default provider fails (must be validated).');
		createProviderDropdown(backupProviderSetting, 'backupProvider');


		containerEl.createEl('h3', { text: 'Configure Providers' });

		// --- Provider Selection Dropdown ---
		// Lists ALL potential providers from DEFAULT_SETTINGS
		new Setting(containerEl)
			.setName('Select Provider to Configure')
			.setDesc('Choose a provider from the list to set its API key and model.')
			.addDropdown(dropdown => {
				// Always populate from DEFAULT_SETTINGS keys
				Object.keys(DEFAULT_SETTINGS.providers).forEach(providerKey =>
					dropdown.addOption(providerKey, providerKey)
				);

				// Ensure selectedProviderKey is valid, fallback to first default provider if needed
				if (!DEFAULT_SETTINGS.providers[this.selectedProviderKey]) {
					this.selectedProviderKey = Object.keys(DEFAULT_SETTINGS.providers)[0];
				}

				dropdown.setValue(this.selectedProviderKey);

				dropdown.onChange(value => {
					this.selectedProviderKey = value;
					this.availableModels = []; // Clear models when switching provider
					// Ensure the configuration exists for the newly selected provider
					this.ensureProviderConfigExists(this.selectedProviderKey);
					this.display(); // Re-render the settings page for the selected provider
				});
			});

		// --- Configuration Section for Selected Provider ---
		// Ensure the selected provider key is valid before proceeding
		if (!this.selectedProviderKey || !DEFAULT_SETTINGS.providers[this.selectedProviderKey]) {
			containerEl.createEl('p', { text: 'Invalid provider selected.' });
			return; // Stop rendering if the key isn't in defaults (shouldn't happen now)
		}

		// Ensure the config exists in the live settings (might have been added by ensureProviderConfigExists)
		const currentConfig = this.ensureProviderConfigExists(this.selectedProviderKey);
		if (!currentConfig) {
			// This case should ideally not be reached if ensureProviderConfigExists works
			containerEl.createEl('p', { text: `Configuration for ${this.selectedProviderKey} is missing.` });
			return;
		}


		containerEl.createEl('h4', { text: `Configure: ${this.selectedProviderKey}` });

		// API Key Input + Refresh/Validation Button
		const apiKeySetting = new Setting(containerEl)
			.setName(`${this.selectedProviderKey} API Key`)
			.setDesc(`API key for ${this.selectedProviderKey}. Required for validation.`);

		// Don't show API key input for 'local' provider
		if (this.selectedProviderKey !== 'local') {
			apiKeySetting.addText(text => {
				text.setPlaceholder('Enter your API key')
					.setValue(currentConfig.apiKey)
					.onChange(async value => {
						currentConfig.apiKey = value.trim();
						this.workingProviders.delete(this.selectedProviderKey); // API key changed, needs re-validation
						this.availableModels = []; // Clear models on key change
						await this.plugin.saveSettings();
						// Re-display to update validation status potentially? Or rely on refresh button?
						// Let's just update the config and wait for refresh button click.
						// Optionally, update the display to show the key needs validation.
					});
				text.inputEl.type = 'password'; // Keep it masked
				text.inputEl.style.width = '300px'; // Adjust width as needed
			});
		} else {
			apiKeySetting.setDesc(`'local' provider does not require an API key.`);
		}

		apiKeySetting.addExtraButton(btn => {
			btn.setIcon('refresh-ccw')
				.setTooltip(`Validate ${this.selectedProviderKey} key & fetch models`)
				.onClick(async () => {
					if (this.selectedProviderKey !== 'local' && !currentConfig.apiKey) {
						new Notice(`API Key required for ${this.selectedProviderKey}`, 5000);
						return;
					}
					new Notice(`Validating ${this.selectedProviderKey}...`);
					btn.setDisabled(true); // Disable button during fetch

					const models = await this.fetchAvailableModels(this.selectedProviderKey, currentConfig.apiKey);

					if (models.length > 0) {
						this.availableModels = models;
						this.workingProviders.add(this.selectedProviderKey);
						new Notice(`${this.selectedProviderKey}: ${models.length} model(s) retrieved. Key validated!`, 5000);
						// If the current model isn't in the new list, reset it
						if (!models.includes(currentConfig.model)) {
							currentConfig.model = models[0]; // Default to the first fetched model
							new Notice(`Model reset to ${models[0]} as previous was unavailable.`, 3000);
						}
						await this.plugin.saveSettings(); // Save potential model change
					} else {
						this.availableModels = [];
						this.workingProviders.delete(this.selectedProviderKey);
						new Notice(`${this.selectedProviderKey}: Validation failed. No models found or invalid API key.`, 5000);
					}
					btn.setDisabled(false); // Re-enable button
					this.display(); // Re-render to update model list and dropdowns
				});
			// Indicate validation status visually (optional)
			if (this.workingProviders.has(this.selectedProviderKey)) {
				const statusSpan = btn.extraSettingsEl.createEl("span", { text: " ✅ Valid", cls: "setting-item-description" });
				// Check if the created element is an HTMLElement before styling
				if (statusSpan instanceof HTMLElement) {
					statusSpan.style.color = "green";
					statusSpan.style.marginLeft = "10px";
				}
			} else if (this.selectedProviderKey !== 'local' && currentConfig.apiKey) {
				const statusSpan = btn.extraSettingsEl.createEl("span", { text: " ❓ Needs Validation", cls: "setting-item-description" });
				// Check if the created element is an HTMLElement before styling
				if (statusSpan instanceof HTMLElement) {
					statusSpan.style.color = "orange";
					statusSpan.style.marginLeft = "10px";
				}
			} else if (this.selectedProviderKey === 'local') {
				// Assume local is always 'valid' conceptually if Ollama is running
				this.workingProviders.add('local'); // Auto-validate local for dropdowns
				const statusSpan = btn.extraSettingsEl.createEl("span", { text: " (N/A)", cls: "setting-item-description" });
				// Check if the created element is an HTMLElement before styling
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
			// Populate with fetched models if available, otherwise use the current setting or default
			const modelOptions = this.availableModels.length > 0
				? this.availableModels
				: (currentConfig.model ? [currentConfig.model] : [DEFAULT_SETTINGS.providers[this.selectedProviderKey]?.model || '']); // Fallback

			if (modelOptions.length === 0 || (modelOptions.length === 1 && !modelOptions[0])) {
				dropdown.addOption('', 'No models available');
				dropdown.setDisabled(true);
			} else {
				modelOptions.forEach(m => dropdown.addOption(m, m));
				dropdown.setDisabled(false);
			}

			// Ensure the current value exists in the options
			const currentModel = currentConfig.model;
			dropdown.setValue(modelOptions.includes(currentModel) ? currentModel : modelOptions[0] || '');

			dropdown.onChange(async value => {
				currentConfig.model = value;
				await this.plugin.saveSettings();
				new Notice(`${this.selectedProviderKey} model set to ${value}`);
			});
		});

		// Display Fetched Models (Read-only List) - Optional
		if (this.availableModels.length > 1) { // Only show if more than one model fetched
			containerEl.createEl('h5', { text: 'Available Models (fetched):' });
			const listEl = containerEl.createEl('ul', { cls: 'provider-model-list' });
			this.availableModels.forEach(model => {
				listEl.createEl('li', { text: model });
			});
		}

		// Delete Provider Button (Optional, allows removing custom keys/models)
		// Only show delete button if the provider exists in the current settings
		if (this.plugin.settings.providers[this.selectedProviderKey]) {
			new Setting(containerEl)
				.setName(`Remove ${this.selectedProviderKey} Configuration`)
				.setDesc(`This will remove the API key and model selection for ${this.selectedProviderKey}. It can be re-configured later.`)
				.addButton(btn => {
					btn.setButtonText('Remove')
						.setIcon('trash')
						.setWarning() // Use warning style for delete buttons
						.onClick(async () => {
							const providerToDelete = this.selectedProviderKey; // Store key before changing it

							// Check if this provider is the default or backup
							const wasDefault = this.plugin.settings.defaultProvider === providerToDelete;
							const wasBackup = this.plugin.settings.backupProvider === providerToDelete;

							// Remove from settings
							delete this.plugin.settings.providers[providerToDelete];
							this.workingProviders.delete(providerToDelete); // Remove from validated set
							this.availableModels = []; // Clear models

							// Reset default/backup if they were deleted
							if (wasDefault) this.plugin.settings.defaultProvider = '';
							if (wasBackup) this.plugin.settings.backupProvider = '';

							// Select the next available provider or the first default one
							this.selectedProviderKey = Object.keys(this.plugin.settings.providers)[0] // First existing
								|| Object.keys(DEFAULT_SETTINGS.providers)[0]; // First default
							this.ensureProviderConfigExists(this.selectedProviderKey); // Ensure new selection exists

							await this.plugin.saveSettings();
							new Notice(`${providerToDelete} configuration removed.`);
							this.display(); // Refresh the settings tab
						});
				});
		}
	}

	// --- Model Fetching Logic (Keep as is, but ensure provider names match keys) ---
	async fetchAvailableModels(providerKey: string, apiKey: string): Promise<string[]> {
		try {
			let url = '';
			let options: RequestInit = { method: 'GET', headers: {} };
			let dataExtractor: (json: any) => string[] = () => [];

			switch (providerKey) {
				case 'openai':
					url = 'https://api.openai.com/v1/models';
					options.headers = { Authorization: `Bearer ${apiKey}` };
					dataExtractor = (json) => json.data?.map((m: any) => m.id).sort() ?? [];
					break;
				case 'local': // Ollama endpoint
					url = 'http://localhost:11434/api/tags'; // Use /api/tags for model names
                    options = {}; // No auth needed for local
					dataExtractor = (json) => json.models?.map((m: any) => m.name).sort() ?? [];
                    // Optional: Add a check to see if Ollama is running
                    try {
                         await fetch('http://localhost:11434'); // Quick check
                    } catch (e) {
                         new Notice("Local provider: Unable to connect to Ollama at http://localhost:11434", 5000);
                         return [];
                    }
					break;
				case 'anthropic':
					// Anthropic API endpoint for models might change, check their docs.
					// Using a common pattern, but verify. Let's assume a placeholder or known URL.
					// url = 'https://api.anthropic.com/v1/models'; // Verify this endpoint
					// options.headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }; // Add version header
					// dataExtractor = (json) => json.data?.map((m: any) => m.id).sort() ?? []; // Adjust based on actual response

                    // TEMP: Anthropic requires more specific handling or libraries.
                    // Returning default model from settings if API fetch isn't implemented/working.
                    // Or, use a known list:
                    console.warn("Anthropic model fetching not fully implemented, returning known models/defaults.");
                    return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-2.1', 'claude-2.0', 'claude-instant-1.2'];
					// break; // Remove break if using the temporary return

				case 'groq':
					url = 'https://api.groq.com/openai/v1/models';
					options.headers = { Authorization: `Bearer ${apiKey}` };
					dataExtractor = (json) => json.data?.map((m: any) => m.id).sort() ?? [];
					break;
				case 'gemini': // Google AI Studio / Vertex AI
					// Endpoint depends on whether it's Vertex AI or AI Studio API Key
                    // Using generative language API endpoint for API Key usage
					url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                    // options.headers = { 'x-goog-api-key': apiKey }; // Key in URL now
                    options = {}; // Reset headers
					dataExtractor = (json) => json.models?.map((m: any) => m.name).sort() ?? []; // name seems correct 'models/gemini-pro' etc.
					break;
				case 'openrouter':
					url = 'https://openrouter.ai/api/v1/models';
					options.headers = { Authorization: `Bearer ${apiKey}` }; // Correct header per OpenRouter docs
					dataExtractor = (json) => json.data?.map((m: any) => m.id).sort() ?? [];
					break;
				case 'grok': // Assuming Grok API doesn't have a public model listing endpoint yet
                    console.warn("Grok model fetching not available, returning default.");
					return [DEFAULT_SETTINGS.providers.grok.model]; // Return the default known model
					// break; // Remove break

				default:
					new Notice(`Model fetching not implemented for provider: ${providerKey}`);
					return []; // No implementation for this provider
			}

            if (!url) return []; // If URL wasn't set (e.g., for providers handled differently)

			const response = await fetch(url, options);

			if (!response.ok) {
				let errorMsg = `HTTP error ${response.status}`;
				try {
					const errorBody = await response.json();
					errorMsg += `: ${errorBody?.error?.message || response.statusText}`;
				} catch (e) { /* Ignore JSON parse error */ }
				throw new Error(errorMsg);
			}

			const json = await response.json();
			return dataExtractor(json);

		} catch (err) {
			console.error(`[${providerKey}] Model fetch error:`, err);
			new Notice(`Error fetching models for ${providerKey}: ${err.message}`, 5000);
			return []; // Return empty list on error
		}
	}
}