import { App, Notice } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/types';
import type { SecretsManager } from '../../../utils/secrets';
import { ImageGateway } from '../../../gateways/ImageGateway';
import { ProviderSelector } from '../sections/ProviderSelector';
import { PromptInput } from '../sections/PromptInput';
import { PromptHistory } from '../sections/PromptHistory';
import { ImageControls } from '../sections/ImageControls';
import { ImageOutputViewer } from '../sections/ImageOutputViewer';
import { ImageHistoryEntry, BaseHistoryEntry } from '../../../utils/historyManager';

export class ImageConsoleTab {
  id = 'image';
  name = 'Image Playground';
  icon = 'image';

  private imageGateway?: ImageGateway;
  private providerSelector: ProviderSelector;
  private promptInput: PromptInput;
  private promptHistory: PromptHistory;
  private imageControls: ImageControls;
  private imageOutputViewer: ImageOutputViewer;
  private validProviders = ['openai', 'stabilityai', 'grok'];
  private blobUrls: string[] = [];

  private providerModels: Record<string, string[]> = {
    openai: ['dall-e-3', 'dall-e-2', 'gpt-image-1'],
    stabilityai: ['stable-diffusion'],
    grok: ['grok-2-image-1212'], // Updated to match xAI API model
  };

  private defaultModels: Record<string, string> = {
    openai: 'gpt-image-1',
    stabilityai: 'stable-diffusion',
    grok: 'grok-2-image-1212', // Updated to match xAI API model
  };

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager,
    private addToHistory: (entry: ImageHistoryEntry) => void
  ) {
    this.providerSelector = new ProviderSelector(app, settings, secrets, this.validProviders, this.providerModels);
    this.promptInput = new PromptInput();
    this.promptHistory = new PromptHistory();
    this.imageControls = new ImageControls();
    this.imageOutputViewer = new ImageOutputViewer();
    console.log('[ImageConsoleTab] Constructor initialized');
  }

  async render(container: HTMLElement) {
    console.log('[ImageConsoleTab] Rendering...');

    try {
      this.imageGateway = await ImageGateway.create(this.secrets, this.settings);
      console.log('[ImageGateway] ImageGateway initialized successfully.');
    } catch (error: any) {
      console.error('[ImageConsoleTab] Failed to initialize ImageGateway:', error);
      new Notice('Failed to initialize Image Console.');
      container.createEl('p', { text: 'Error initializing Image Console.' });
      return;
    }

    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const fixedSection = container.createEl('div', { cls: 'ai-console-fixed-section' });

    await this.providerSelector.render(fixedSection);

    if (!this.providerSelector.getSelectedProvider()) {
      new Notice('No providers available. Please configure API keys.');
      return;
    }

    const updateUI = () => {
      const provider = this.providerSelector.getSelectedProvider();
      const model = this.providerSelector.getSelectedModel() || this.defaultModels[provider] || 'gpt-image-1';
      console.log('[ImageConsoleTab] updateUI called - Provider:', provider, 'Model:', model);
      this.imageControls.updateControls(model);
    };

    this.providerSelector.onProviderChange(updateUI);
    this.providerSelector.onModelChange(updateUI);

    const promptRow = fixedSection.createEl('div', { cls: 'ai-console-prompt-section-full' });
    this.promptInput.render(promptRow, () => {});
    const promptTextarea = promptRow.querySelector('textarea');
    if (promptTextarea?.nextElementSibling?.tagName === 'BUTTON') {
      promptTextarea.nextElementSibling.remove();
    }

    this.imageControls.render(fixedSection);

    const runButtonRow = fixedSection.createEl('div', { cls: 'ai-console-run-button-row' });
    const runButton = runButtonRow.createEl('button', { text: 'Run', cls: 'ai-console-run-btn' });
    runButton.addEventListener('click', this.runPrompt.bind(this));

    const scrollableSection = container.createEl('div', { cls: 'ai-console-scrollable-section' });

    this.imageOutputViewer.render(scrollableSection);
    this.promptHistory.render(scrollableSection, this.historyClickHandler.bind(this));

    this.providerSelector.setProvider('openai', this.defaultModels['openai']);
    updateUI();
  }

  private async runPrompt() {
    console.log('[ImageConsoleTab] Run button clicked.');

    const provider = this.providerSelector.getSelectedProvider();
    const model = this.providerSelector.getSelectedModel() || this.defaultModels[provider] || 'gpt-image-1';
    const prompt = this.promptInput.getPrompt().trim();
    const size = this.imageControls.getSize();
    const n = this.imageControls.getN();
    const quality = this.imageControls.getQuality();
    const outputFormat = this.imageControls.getOutputFormat();

    if (!prompt) {
      new Notice('Please enter a prompt.');
      return;
    }
    if (!provider) {
      new Notice('Please select a provider.');
      return;
    }
    if (!this.imageGateway) {
      new Notice('ImageGateway not initialized.');
      return;
    }

    if (prompt.length > 1000) {
      new Notice('Prompt is too long. Please shorten it to 1000 characters or less.');
      return;
    }
    if (prompt.toLowerCase().includes('harmful') || prompt.toLowerCase().includes('explicit')) {
      new Notice('Prompt may violate content policies. Please revise.');
      return;
    }

    const request: any = {
      prompt,
      model,
      size,
      n,
    };

    // Provider-specific request configuration
    if (provider === 'openai') {
      if (model === 'gpt-image-1') {
        request.output_format = outputFormat;
        if (quality && quality !== 'auto') {
          request.quality = quality;
        }
      } else {
        request.response_format = 'b64_json';
        if (model === 'dall-e-3' && quality) {
          request.quality = quality;
        }
      }
    } else if (provider === 'grok') {
      request.output_format = outputFormat;
      if (quality && quality !== 'auto') {
        request.quality = quality;
      }
    } else if (provider === 'stabilityai') {
      request.response_format = 'b64_json';
      // Add stabilityai-specific parameters if needed
    }

    console.log('[ImageConsoleTab] Generated request:', request);

    const adapter = (this.imageGateway as any).adapters[provider];
    if (!adapter) {
      new Notice(`No adapter found for provider: ${provider}.`);
      console.error('[ImageConsoleTab] No adapter found for provider:', provider);
      return;
    }

    try {
      this.imageOutputViewer.setLoading();

      const result = await adapter.generate(request);

      const base64Urls: string[] = result.imageUrls || [];
      const format = provider === 'grok' || model === 'gpt-image-1' ? outputFormat : 'png';
      this.imageOutputViewer.setImages(base64Urls, format);

      const historyEntry: ImageHistoryEntry = {
        provider,
        model,
        prompt,
        imageUrls: base64Urls,
        timestamp: new Date().toLocaleString(),
        size,
        quality,
        output_format: provider === 'grok' || model === 'gpt-image-1' ? outputFormat : undefined,
      };

      this.addToHistory(historyEntry);
      console.log('[ImageConsoleTab] Image(s) generated, base64 count:', base64Urls.length);
    } catch (error: any) {
      console.error('[ImageConsoleTab] Generation error:', error);
      let errorMessage = error.message || 'Unknown error';
      if (error.message.includes('400')) {
        errorMessage += '. Check model parameters.';
      } else if (error.message.includes('401')) {
        errorMessage += '. Verify your API key.';
      } else if (error.message.includes('429')) {
        errorMessage += '. Rate limit exceeded. Try again later.';
      }
      new Notice(`Failed to generate image: ${errorMessage}`);
      this.imageOutputViewer.setError(errorMessage);
    }
  }

  private historyClickHandler(entry: ImageHistoryEntry) {
    this.providerSelector.setProvider(entry.provider, entry.model);
    this.promptInput.setPrompt(entry.prompt);
    this.imageControls.setControls(
      entry.size || '1024x1024',
      1, // N is not stored in history, default to 1
      entry.quality || (entry.model === 'dall-e-3' ? 'standard' : entry.provider === 'grok' ? 'standard' : 'auto'),
      entry.output_format || 'png'
    );
    this.imageOutputViewer.setImages(entry.imageUrls || [], entry.output_format || 'png');
    console.log('[ImageConsoleTab] History entry selected:', entry);
  }

  cleanup() {
    this.blobUrls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.blobUrls = [];
    this.providerSelector.cleanup();
    this.promptInput.cleanup();
    this.promptHistory.cleanup();
    this.imageControls.cleanup();
    this.imageOutputViewer.cleanup();
  }

  renderHistory(history: BaseHistoryEntry[]) {
    console.log('[ImageConsoleTab] Rendering history:', history);
    const imageHistory = history as ImageHistoryEntry[];
    this.promptHistory.updateHistory(imageHistory, this.historyClickHandler.bind(this));
  }
}