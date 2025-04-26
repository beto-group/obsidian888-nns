// src/ui/console/tabs/TextConsoleTab.ts
import { App, Notice, Setting, SliderComponent, TextComponent } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/settings';
import type { SecretsManager } from '../../../utils/secrets';
import { TextGateway } from '../../../gateways/TextGateway';
import type { LLMRequest, LLMResponse } from '../../../core/Adapter';
import { ProviderSelector } from '../sections/ProviderSelector';
import { ParameterControls } from '../sections/ParameterControls';
import { PromptInput } from '../sections/PromptInput';
import { OutputViewer } from '../sections/OutputViewer';
import { PromptHistory } from '../sections/PromptHistory';

interface PromptHistoryEntry {
  provider: string;
  model: string;
  prompt: string;
  output: string;
  timestamp: string;
}

export class TextConsoleTab {
  id = 'text';
  name = 'Text Playground';
  icon = 'file-text';
  private textGateway?: TextGateway;
  private providerSelector: ProviderSelector;
  private parameterControls: ParameterControls;
  private promptInput: PromptInput;
  private outputViewer: OutputViewer;
  private promptHistory: PromptHistory;

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager,
    private addToHistory: (entry: PromptHistoryEntry) => void,
    renderHistory: () => void
  ) {
    this.providerSelector = new ProviderSelector(app, settings, secrets);
    this.parameterControls = new ParameterControls();
    this.promptInput = new PromptInput();
    this.outputViewer = new OutputViewer();
    this.promptHistory = new PromptHistory();
  }

  async render(container: HTMLElement) {
    console.log('[TextConsoleTab] Rendering...');
    try {
      this.textGateway = await TextGateway.create(this.secrets, this.settings);
      console.log('[TextConsoleTab] TextGateway initialized successfully.');
    } catch (error: any) {
      console.error('[TextConsoleTab] Failed to initialize TextGateway:', error);
      new Notice('Failed to initialize Text Console. Some features may be limited.');
      container.createEl('p', { text: 'Error initializing Text Console.' });
    }

    // Render sections
    this.providerSelector.render(container, this.textGateway);
    this.parameterControls.render(container);
    this.promptInput.render(container, this.runPrompt.bind(this));
    this.outputViewer.render(container);
    this.promptHistory.render(container, this.historyClickHandler.bind(this));
  }

  private async runPrompt() {
    console.log('[TextConsoleTab] Run button clicked.');
    const provider = this.providerSelector.getSelectedProvider();
    const model = this.providerSelector.getSelectedModel() || this.settings.providers[provider]?.model || '';
    const prompt = this.promptInput.getPrompt().trim();
    const temperature = this.parameterControls.getTemperature();
    const maxTokens = this.parameterControls.getMaxTokens();

    this.outputViewer.clear();

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
      this.outputViewer.setOutput('Error: TextGateway not initialized.');
      return;
    }

    const request: LLMRequest = { prompt, model, temperature, maxTokens };
    const adapter = (this.textGateway as any).adapters[provider];
    if (!adapter) {
      new Notice(`No adapter found for provider: ${provider}. Please check configuration.`);
      this.outputViewer.setOutput(`Error: No adapter for ${provider}.`);
      console.error('[TextConsoleTab] No adapter found for provider:', provider);
      return;
    }

    try {
      this.outputViewer.setOutput('Generating...');
      console.log('[TextConsoleTab] Testing provider:', provider, 'with request:', {
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
        console.warn('[TextConsoleTab] Unexpected response format from provider:', provider, result);
        output = '[Unexpected response format]';
      }

      this.outputViewer.setOutput(output);
      this.outputViewer.setCode(`await window.aiNNS.text.generate("${prompt.replace(/"/g, '\\"')}", { model: "${model}", temperature: ${temperature}, maxTokens: ${maxTokens} });`);
      this.addToHistory({ provider, model, prompt, output, timestamp: new Date().toLocaleString() });
      console.log('[TextConsoleTab] Response received for', provider, ':', {
        output: output.length > 50 ? output.slice(0, 50) + '...' : output,
        tokensUsed,
      });
    } catch (error: any) {
      console.error('[TextConsoleTab] Generation error for', provider, ':', error);
      let errorMessage = `Error: ${error.message || 'Unknown error'}`;
      this.outputViewer.setOutput(errorMessage);
      new Notice(`Failed to generate with ${provider}: ${error.message || 'Unknown error'}`);
    }
  }

  private historyClickHandler(entry: PromptHistoryEntry) {
    this.providerSelector.setProvider(entry.provider, entry.model);
    this.promptInput.setPrompt(entry.prompt);
  }

  cleanup() {
    this.providerSelector.cleanup();
    this.parameterControls.cleanup();
    this.promptInput.cleanup();
    this.outputViewer.cleanup();
    this.promptHistory.cleanup();
  }

  renderHistory(history: PromptHistoryEntry[]) {
    this.promptHistory.updateHistory(history, this.historyClickHandler.bind(this));
  }
}