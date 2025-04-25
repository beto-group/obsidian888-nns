import { App, Modal, Setting, Notice, SliderComponent, TextComponent } from 'obsidian';
import type { MyPluginSettings } from '../../settings/settings';
import type { SecretsManager } from '../../utils/secrets';
import { providerMetadata, providerFetchers } from '../../settings/providers/index';
import { TextGateway } from '../../gateways/TextGateway';
import type { LLMRequest, LLMResponse } from '../../core/Adapter';

interface PromptHistoryEntry {
  provider: string;
  model: string;
  prompt: string;
  output: string;
  timestamp: string;
}

export class AiConsoleModal extends Modal {
  private settings: MyPluginSettings;
  private secrets: SecretsManager;
  private textGateway?: TextGateway;
  private container!: HTMLElement;
  private providerSelectEl!: HTMLSelectElement;
  private modelSelectEl!: HTMLSelectElement;
  private promptHistory: PromptHistoryEntry[] = [];
  private maxHistoryEntries = 10;
  private historyContainer!: HTMLElement;
  private historyList!: HTMLElement;
  private isHistoryVisible: boolean = true;

  constructor(app: App, settings: MyPluginSettings, secrets: SecretsManager) {
    super(app);
    this.settings = settings;
    this.secrets = secrets;
  }

  async onOpen() {
    console.log('[AiConsoleModal] Opening modal...');
    this.titleEl.setText('AI Console Playground');
    this.contentEl.empty();
    this.container = this.contentEl.createEl('div', { cls: 'ai-console-container' });

    try {
      this.textGateway = await TextGateway.create(this.secrets, this.settings);
      console.log('[AiConsoleModal] TextGateway initialized successfully.');
    } catch (error: any) {
      console.error('[AiConsoleModal] Failed to initialize TextGateway:', error);
      new Notice('Failed to initialize AI Console. Some features may be limited.');
      this.container.createEl('p', { text: 'Error initializing AI Console. You can still enter prompts below, but provider/model selection may not work.' });
    }

    const providers: string[] = [];
    try {
      for (const key of Object.keys(this.settings.providers)) {
        const meta = providerMetadata[key];
        if (meta.requiresApiKey) {
          const apiKey = await this.secrets.getSecret(key);
          if (apiKey) providers.push(key);
        } else {
          providers.push(key);
        }
      }
      console.log('[AiConsoleModal] Providers loaded:', providers);
    } catch (error) {
      console.error('[AiConsoleModal] Error gathering providers:', error);
      new Notice('Failed to load providers. Using fallback options.');
    }

    const controlsSection = this.container.createEl('div', { cls: 'ai-console-controls' });
    controlsSection.createEl('h3', { text: 'Settings' });

    try {
      new Setting(controlsSection)
        .setName('Provider')
        .setDesc('Select the AI provider to use.')
        .addDropdown(dropdown => {
          this.providerSelectEl = dropdown.selectEl;
          if (providers.length === 0) {
            dropdown.addOption('', 'No providers available');
          } else {
            providers.forEach(p => dropdown.addOption(p, p));
            const initial =
              this.settings.defaultProvider && providers.includes(this.settings.defaultProvider)
                ? this.settings.defaultProvider
                : providers[0];
            dropdown.setValue(initial);
            dropdown.onChange(async value => {
              console.log('[AiConsoleModal] Provider changed to:', value);
              await this.updateModelDropdown(value);
            });
          }
        });
    } catch (error) {
      console.error('[AiConsoleModal] Error creating provider dropdown:', error);
      controlsSection.createEl('p', { text: 'Error loading provider dropdown.' });
    }

    try {
      new Setting(controlsSection)
        .setName('Model')
        .setDesc('Select the model for the selected provider.')
        .addDropdown(dropdown => {
          this.modelSelectEl = dropdown.selectEl;
          dropdown.setDisabled(providers.length === 0);
        });
    } catch (error) {
      console.error('[AiConsoleModal] Error creating model dropdown:', error);
      controlsSection.createEl('p', { text: 'Error loading model dropdown.' });
    }

    if (providers.length > 0) {
      try {
        await this.updateModelDropdown(this.providerSelectEl.value);
      } catch (error) {
        console.error('[AiConsoleModal] Error populating models:', error);
      }
    }

    const paramsContainer = controlsSection.createEl('div', { cls: 'ai-console-params' });
    paramsContainer.createEl('h4', { text: 'Parameters' });

    let tempSetting: Setting, maxTokensSetting: Setting;
    try {
      tempSetting = new Setting(paramsContainer)
        .setName('Temperature')
        .setDesc('Controls randomness (0.0 to 1.0).')
        .addSlider(slider => slider.setLimits(0, 1, 0.1).setValue(0.7).setDynamicTooltip());
    } catch (error) {
      console.error('[AiConsoleModal] Error creating temperature slider:', error);
      paramsContainer.createEl('p', { text: 'Error loading temperature slider.' });
    }

    try {
      maxTokensSetting = new Setting(paramsContainer)
        .setName('Max Tokens')
        .setDesc('Maximum number of tokens to generate.')
        .addText(text =>
          text
            .setPlaceholder('1000')
            .setValue('1000')
            .onChange(value => {
              if (isNaN(parseInt(value)) && value !== '') {
                new Notice('Max Tokens must be a number.');
                text.setValue('1000');
              }
            })
        );
    } catch (error) {
      console.error('[AiConsoleModal] Error creating max tokens input:', error);
      paramsContainer.createEl('p', { text: 'Error loading max tokens input.' });
    }

    const promptSection = this.container.createEl('div', { cls: 'ai-console-prompt-section' });
    const promptInput = promptSection.createEl('textarea', {
      attr: { placeholder: 'Enter your prompt here...' },
      cls: 'ai-console-prompt'
    }) as HTMLTextAreaElement;

    const runBtn = promptSection.createEl('button', { text: 'Run', cls: 'ai-console-run-btn' });

    const outputSection = this.container.createEl('div', { cls: 'ai-console-output-section' });
    outputSection.createEl('h4', { text: 'Output' });
    const outputArea = outputSection.createEl('div', { cls: 'ai-console-output' });
    const codeBlock = outputSection.createEl('pre', { cls: 'ai-console-code' });

    this.historyContainer = this.container.createEl('div', { cls: 'ai-console-history' });
    const historyHeader = this.historyContainer.createEl('h4', { text: 'Recent Prompts ▼' });
    this.historyList = this.historyContainer.createEl('ul', { cls: 'ai-console-history-list' });

    historyHeader.addEventListener('click', () => {
      this.isHistoryVisible = !this.isHistoryVisible;
      this.historyList.style.display = this.isHistoryVisible ? 'block' : 'none';
      historyHeader.textContent = `Recent Prompts ${this.isHistoryVisible ? '▼' : '▲'}`;
    });

    runBtn.onclick = async () => {
      console.log('[AiConsoleModal] Run button clicked.');
      const provider = this.providerSelectEl.value;
      const model =
        this.modelSelectEl.value || this.settings.providers[provider]?.model || '';
      const prompt = promptInput.value.trim();
      let temperature = 0.7;
      let maxTokens = 1000;

      try {
        temperature = parseFloat((tempSetting!.components[0] as SliderComponent).getValue().toString()) || 0.7;
      } catch (error) {
        console.error('[AiConsoleModal] Error getting temperature:', error);
        new Notice('Failed to get temperature value. Using default (0.7).');
      }

      try {
        maxTokens = parseInt((maxTokensSetting!.components[0] as TextComponent).getValue()) || 1000;
      } catch (error) {
        console.error('[AiConsoleModal] Error getting max tokens:', error);
        new Notice('Failed to get max tokens value. Using default (1000).');
      }

      outputArea.empty();
      codeBlock.empty();

      if (!prompt) {
        new Notice('Please enter a prompt.');
        return;
      }
      if (!provider) {
        new Notice('Please select a provider.');
        return;
      }

      if (!this.textGateway) {
        new Notice('TextGateway not initialized. Cannot generate response.');
        outputArea.setText('Error: TextGateway not initialized.');
        return;
      }

      const request: LLMRequest = { prompt, model, temperature, maxTokens };
      const adapter = (this.textGateway as any).adapters[provider];
      if (!adapter) {
        new Notice(`No adapter found for provider: ${provider}. Please check configuration.`);
        outputArea.setText(`Error: No adapter for ${provider}.`);
        console.error('[AiConsoleModal] No adapter found for provider:', provider);
        return;
      }

      // Check API key for providers requiring it
      if (providerMetadata[provider]?.requiresApiKey) {
        const apiKey = await this.secrets.getSecret(provider);
        if (!apiKey) {
          const errorMessage = `Error: No API key configured for ${provider}. Please set it in settings.`;
          outputArea.setText(errorMessage);
          new Notice(errorMessage);
          console.error(`[${provider}] No API key found.`);
          return;
        }
      }

      try {
        outputArea.setText('Generating...');
        console.log('[AiConsoleModal] Testing provider:', provider, 'with request:', {
          prompt: prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt,
          model,
          temperature,
          maxTokens,
        });

        const result: LLMResponse = await adapter.generate(request);
        let output = '[No result returned]';
        let tokensUsed = 0;

        if (result && typeof result.output === 'string') {
          output = result.output.trim();
          tokensUsed = result.tokensUsed || 0;
        } else {
          console.warn('[AiConsoleModal] Unexpected response format from provider:', provider, result);
          output = '[Unexpected response format]';
        }

        outputArea.setText(output);
        codeBlock.setText(
          `await window.aiNNS.text.generate("${prompt.replace(/"/g, '\\"')}", { model: "${model}", temperature: ${temperature}, maxTokens: ${maxTokens} });`
        );
        this.addToHistory({ provider, model, prompt, output, timestamp: new Date().toLocaleString() });
        this.renderHistory(this.historyList);
        console.log('[AiConsoleModal] Response received for', provider, ':', {
          output: output.length > 50 ? output.slice(0, 50) + '...' : output,
          tokensUsed,
        });
      } catch (error: any) {
        console.error('[AiConsoleModal] Generation error for', provider, ':', error);
        let errorMessage = `Error: ${error.message || 'Unknown error'}`;
        if (provider === 'grok' && error.message.includes('401')) {
          errorMessage = 'Error: Invalid or missing Grok API key. Please verify your xAI API key in settings at https://x.ai/api.';
        } else if (provider === 'grok' && error.message.includes('net::ERR_')) {
          errorMessage = 'Error: Network issue connecting to xAI API. Check your internet connection or firewall settings.';
        } else if (provider === 'gemini' && error.message.includes('404')) {
          errorMessage = `Error: Model "${model}" not found or incorrect endpoint for Gemini (tried https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent). Verify the model, API version, or region restrictions at https://ai.google.dev/docs.`;
        } else if (provider === 'gemini' && error.message.includes('net::ERR_')) {
          errorMessage = 'Error: Network issue connecting to Gemini API. Check your internet connection or firewall settings.';
        }
        outputArea.setText(errorMessage);
        new Notice(`Failed to generate with ${provider}: ${error.message || 'Unknown error'}`);
      }
    };

    const style = this.container.createEl('style');
    style.textContent = `
      .ai-console-container {
        padding: 20px;
        max-width: 900px;
        margin: auto;
        background: var(--background-primary);
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      .ai-console-controls {
        margin-bottom: 20px;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
      }
      .ai-console-controls h3 {
        margin: 0 0 15px 0;
        font-size: 18px;
        color: var(--text-normal);
      }
      .ai-console-params {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid var(--background-modifier-border);
      }
      .ai-console-params h4 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: var(--text-normal);
      }
      .ai-console-prompt-section {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        align-items: flex-end;
      }
      .ai-console-prompt {
        flex: 1;
        width: 100%;
        height: 120px;
        padding: 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary-alt);
        color: var(--text-normal);
        font-size: 14px;
        resize: vertical;
        transition: border-color 0.2s ease;
      }
      .ai-console-prompt:focus {
        border-color: var(--interactive-accent);
        outline: none;
      }
      .ai-console-run-btn {
        padding: 10px 20px;
        background: var(--interactive-accent);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .ai-console-run-btn:hover {
        background: var(--interactive-accent-hover);
      }
      .ai-console-output-section {
        margin-bottom: 20px;
      }
      .ai-console-output-section h4 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: var(--text-normal);
      }
      .ai-console-output {
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 6px;
        min-height: 120px;
        white-space: pre-wrap;
        border: 1px solid var(--background-modifier-border);
        font-size: 14px;
        color: var(--text-normal);
      }
      .ai-console-code {
        margin-top: 10px;
        padding: 15px;
        background: var(--code-block-background);
        border-radius: 6px;
        overflow-x: auto;
        font-size: 13px;
        color: var(--text-muted);
        border: 1px solid var(--background-modifier-border);
      }
      .ai-console-history {
        margin-top: 20px;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
      }
      .ai-console-history h4 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: var(--text-normal);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .ai-console-history-list {
        list-style: none;
        padding: 0;
        max-height: 200px;
        overflow-y: auto;
      }
      .ai-console-history-list li {
        padding: 10px;
        border-bottom: 1px solid var(--background-modifier-border);
        cursor: pointer;
        font-size: 14px;
        color: var(--text-normal);
        transition: background 0.2s ease;
      }
      .ai-console-history-list li:hover {
        background: var(--background-modifier-hover);
      }
      .ai-console-history-list li:last-child {
        border-bottom: none;
      }
      .ai-console-history-list strong {
        color: var(--text-accent);
      }
      .ai-console-history-list span {
        color: var(--text-muted);
      }
    `;
    console.log('[AiConsoleModal] Modal UI fully rendered.');
  }

  private async updateModelDropdown(provider: string) {
    console.log('[AiConsoleModal] Updating model dropdown for provider:', provider);
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
      console.log('[AiConsoleModal] Models loaded:', models);
    } catch (error) {
      console.error('[AiConsoleModal] Error fetching models:', error);
      this.modelSelectEl.add(new Option('Error fetching models', ''));
    }
  }

  private addToHistory(entry: PromptHistoryEntry) {
    this.promptHistory.unshift(entry);
    if (this.promptHistory.length > this.maxHistoryEntries) this.promptHistory.pop();
  }

  private renderHistory(list: HTMLElement) {
    list.empty();
    this.promptHistory.forEach(entry => {
      const li = list.createEl('li');
      li.createEl('strong', { text: `[${entry.timestamp}] ${entry.provider} (${entry.model})` });
      li.createEl('br');
      li.createEl('span', { text: `Prompt: ${entry.prompt}${entry.prompt.length>50?'...':''}` });
      li.addEventListener('click', () => {
        this.providerSelectEl.value = entry.provider;
        this.updateModelDropdown(entry.provider).then(() => {
          this.modelSelectEl.value = entry.model;
        });
      });
    });
  }

  onClose() {
    this.container.empty();
    console.log('[AiConsoleModal] Modal closed.');
  }
}