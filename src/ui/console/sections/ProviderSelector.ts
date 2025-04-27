// src/ui/console/sections/ProviderSelector.ts
import { App, Setting, Notice } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/types';
import type { SecretsManager } from '../../../utils/secrets';
import { providerMetadata, providerFetchers } from '../../../settings/providers/index';
import type { TextGateway } from '../../../gateways/TextGateway';

export class ProviderSelector {
  private providerSelectEl: HTMLSelectElement;
  private modelSelectEl: HTMLSelectElement;
  private providers: string[] = [];
  private providerChangeListeners: ((provider: string) => void)[] = [];
  private modelChangeListeners: ((model: string) => void)[] = []; // Added for model change events

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager,
    private allowedProviders?: string[], // Optional filter for providers
    private providerModels?: Record<string, string[]> // Optional override for models per provider
  ) {}

  async render(container: HTMLElement, textGateway?: TextGateway) {
    const controlsSection = container.createEl('div', { cls: 'ai-console-controls' });
    controlsSection.createEl('h3', { text: 'Settings' });

    this.providers = [];

    try {
      for (const key of Object.keys(this.settings.providers)) {
        // Only include providers that are in allowedProviders, if provided
        if (this.allowedProviders && !this.allowedProviders.includes(key)) {
          continue;
        }
        const meta = providerMetadata[key];
        if (meta.requiresApiKey) {
          const apiKey = await this.secrets.getSecret(key);
          if (apiKey) this.providers.push(key);
        } else {
          this.providers.push(key);
        }
      }
      console.log('[ProviderSelector] Providers loaded:', this.providers);
    } catch (error) {
      console.error('[ProviderSelector] Error gathering providers:', error);
      new Notice('Failed to load providers. Using fallback options.');
    }

    new Setting(controlsSection)
      .setName('Provider')
      .setDesc('Select the AI provider to use.')
      .addDropdown(dropdown => {
        this.providerSelectEl = dropdown.selectEl;
        if (this.providers.length === 0) {
          dropdown.addOption('', 'No providers available');
        } else {
          this.providers.forEach(p => dropdown.addOption(p, p));
          const defaultProvider = this.settings.categories?.text?.defaultProvider;
          const initial = defaultProvider && this.providers.includes(defaultProvider)
            ? defaultProvider
            : this.providers[0];
          dropdown.setValue(initial);

          dropdown.onChange(async value => {
            console.log('[ProviderSelector] Provider changed to:', value);
            await this.updateModelDropdown(value);
            this.providerChangeListeners.forEach(listener => listener(value));
          });
        }
      });

    const modelSetting = new Setting(controlsSection)
      .setName('Model')
      .setDesc('Select the model for the selected provider.');

    modelSetting.controlEl.style.flexDirection = 'column';
    modelSetting.controlEl.style.alignItems = 'stretch';

    modelSetting.addDropdown(dropdown => {
      this.modelSelectEl = dropdown.selectEl;
      this.modelSelectEl.style.width = '100%'; // Make dropdown full width
      this.modelSelectEl.setAttr('data-type', 'model'); // Add for debugging or future use
      dropdown.setDisabled(this.providers.length === 0);
      dropdown.onChange(value => {
        console.log('[ProviderSelector] Model changed to:', value);
        this.modelChangeListeners.forEach(listener => listener(value));
      });
    });

    if (this.providers.length > 0) {
      try {
        await this.updateModelDropdown(this.providerSelectEl.value);
      } catch (error) {
        console.error('[ProviderSelector] Error populating models:', error);
      }
    }
  }

  private async updateModelDropdown(provider: string) {
    console.log('[ProviderSelector] Updating model dropdown for provider:', provider);
    this.modelSelectEl.innerHTML = '';
    this.modelSelectEl.disabled = true;

    if (!provider || !this.settings.providers[provider]) {
      this.modelSelectEl.add(new Option('No models available', ''));
      return;
    }

    try {
      let models: string[] = [];

      // Use provided providerModels if available, otherwise fetch dynamically
      if (this.providerModels && this.providerModels[provider]) {
        models = this.providerModels[provider];
      } else {
        if (providerMetadata[provider].requiresApiKey) {
          const apiKey = await this.secrets.getSecret(provider);
          if (apiKey) {
            models = await providerFetchers[provider](apiKey, this.app);
          }
        } else {
          models = await providerFetchers[provider]('', this.app);
        }
      }

      if (!models.length) {
        this.modelSelectEl.add(new Option('No models available', ''));
        return;
      }

      models.forEach(m => this.modelSelectEl.add(new Option(m, m)));
      const current = this.settings.providers[provider].model;
      this.modelSelectEl.value = models.includes(current) ? current : models[0];
      this.modelSelectEl.disabled = false;
      console.log('[ProviderSelector] Models loaded:', models);
      // Trigger model change event to ensure UI updates
      this.modelChangeListeners.forEach(listener => listener(this.modelSelectEl.value));
    } catch (error) {
      console.error('[ProviderSelector] Error fetching models:', error);
      this.modelSelectEl.add(new Option('Error fetching models', ''));
    }
  }

  onProviderChange(listener: (provider: string) => void) {
    this.providerChangeListeners.push(listener);
  }

  onModelChange(listener: (model: string) => void) {
    this.modelChangeListeners.push(listener);
  }

  getSelectedProvider(): string {
    return this.providerSelectEl.value;
  }

  getSelectedModel(): string {
    return this.modelSelectEl.value;
  }

  setProvider(provider: string, model: string) {
    if (this.providers.includes(provider)) {
      this.providerSelectEl.value = provider;
      this.updateModelDropdown(provider).then(() => {
        if (this.modelSelectEl.options.length > 0) {
          this.modelSelectEl.value = model;
          // Trigger model change event
          this.modelChangeListeners.forEach(listener => listener(model));
        }
      });
      this.providerChangeListeners.forEach(listener => listener(provider));
    }
  }

  cleanup() {
    this.providerChangeListeners = [];
    this.modelChangeListeners = [];
  }
}