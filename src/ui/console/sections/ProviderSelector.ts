// src/ui/console/sections/ProviderSelector.ts
import { App, Setting, Notice } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/settings';
import type { SecretsManager } from '../../../utils/secrets';
import { providerMetadata, providerFetchers } from '../../../settings/providers/index';
import type { TextGateway } from '../../../gateways/TextGateway';

export class ProviderSelector {
  private providerSelectEl: HTMLSelectElement;
  private modelSelectEl: HTMLSelectElement;
  private providers: string[] = [];

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager
  ) {}

  async render(container: HTMLElement, textGateway?: TextGateway) {
    const controlsSection = container.createEl('div', { cls: 'ai-console-controls' });
    controlsSection.createEl('h3', { text: 'Settings' });

    this.providers = [];

    try {
      for (const key of Object.keys(this.settings.providers)) {
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
          const initial = this.settings.defaultProvider && this.providers.includes(this.settings.defaultProvider)
            ? this.settings.defaultProvider
            : this.providers[0];
          dropdown.setValue(initial);
          dropdown.onChange(async value => {
            console.log('[ProviderSelector] Provider changed to:', value);
            await this.updateModelDropdown(value);
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
      this.modelSelectEl.style.width = '100%'; // ⬅️ make dropdown full width
      dropdown.setDisabled(this.providers.length === 0);
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
      if (providerMetadata[provider].requiresApiKey) {
        const apiKey = await this.secrets.getSecret(provider);
        if (apiKey) {
          models = await providerFetchers[provider](apiKey, this.app);
        }
      } else {
        models = await providerFetchers[provider]('', this.app);
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
    } catch (error) {
      console.error('[ProviderSelector] Error fetching models:', error);
      this.modelSelectEl.add(new Option('Error fetching models', ''));
    }
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
        }
      });
    }
  }

  cleanup() {
    // No cleanup needed for dropdowns
  }
}