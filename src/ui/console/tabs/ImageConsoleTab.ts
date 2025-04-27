// src/ui/console/tabs/ImageConsoleTab.ts
import { App, Notice, Setting } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/types';
import type { SecretsManager } from '../../../utils/secrets';
import { ImageGateway } from '../../../gateways/ImageGateway';
import { ProviderSelector } from '../sections/ProviderSelector';
import { PromptInput } from '../sections/PromptInput';
import { PromptHistory } from '../sections/PromptHistory';

interface ImageHistoryEntry {
  provider: string;
  model: string;
  prompt: string;
  imageUrls: string[];
  timestamp: string;
  size?: string;
  quality?: string;
  output_format?: string;
}

export class ImageConsoleTab {
  id = 'image';
  name = 'Image Playground';
  icon = 'image';

  private imageGateway?: ImageGateway;
  private providerSelector: ProviderSelector;
  private promptInput: PromptInput;
  private promptHistory: PromptHistory;
  private history: ImageHistoryEntry[] = [];
  private validProviders = ['openai', 'stabilityai', 'grok'];
  private blobUrls: string[] = [];

  private sizeDropdown?: HTMLSelectElement;
  private nImagesInput?: HTMLInputElement;
  private qualityDropdown?: HTMLSelectElement;
  private outputFormatDropdown?: HTMLSelectElement;
  private outputArea?: HTMLElement;

  private providerModels: Record<string, string[]> = {
    openai: ['dall-e-3', 'dall-e-2', 'gpt-image-1'],
    stabilityai: ['stable-diffusion'],
    grok: ['grok-image'],
  };

  private defaultModels: Record<string, string> = {
    openai: 'dall-e-3',
    stabilityai: 'stable-diffusion',
    grok: 'grok-image',
  };

  private modelSizes: Record<string, string[]> = {
    'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
    'dall-e-2': ['256x256', '512x512', '1024x1024'],
    'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536'],
    'stable-diffusion': ['512x512', '1024x1024'],
    'grok-image': ['1024x1024'],
  };

  private maxN: Record<string, number> = {
    'dall-e-3': 1,
    'dall-e-2': 10,
    'gpt-image-1': 10,
    'stable-diffusion': 4,
    'grok-image': 1,
  };

  private modelQualities: Record<string, string[]> = {
    'dall-e-3': ['standard', 'hd'],
    'dall-e-2': [],
    'gpt-image-1': ['low', 'medium', 'high', 'auto'],
    'stable-diffusion': [],
    'grok-image': [],
  };

  private outputFormats: string[] = ['png', 'jpeg', 'webp'];

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager,
    private addToHistory?: (entry: ImageHistoryEntry) => void,
    private updateHistoryCallback?: () => void
  ) {
    this.providerSelector = new ProviderSelector(app, settings, secrets, this.validProviders, this.providerModels);
    this.promptInput = new PromptInput();
    this.promptHistory = new PromptHistory();
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
      const model = this.providerSelector.getSelectedModel() || this.defaultModels[provider] || 'dall-e-3';

      console.log('[ImageConsoleTab] updateUI called - Provider:', provider, 'Model:', model);

      // Update size dropdown
      if (this.sizeDropdown) {
        const currentSize = this.sizeDropdown.value || '';
        console.log('[ImageConsoleTab] Current size:', currentSize);
        this.sizeDropdown.innerHTML = '';
        const sizes = this.modelSizes[model] || ['1024x1024'];
        sizes.forEach(size => this.sizeDropdown!.add(new Option(size, size)));
        this.sizeDropdown.value = sizes.includes(currentSize) ? currentSize : sizes[0];
        console.log('[ImageConsoleTab] Updated size dropdown:', this.sizeDropdown.value);
      } else {
        console.warn('[ImageConsoleTab] sizeDropdown is undefined');
      }

      // Update max n
      if (this.nImagesInput) {
        const max = this.maxN[model] || 1;
        this.nImagesInput.max = max.toString();
        const currentN = parseInt(this.nImagesInput.value) || 1;
        if (currentN > max) {
          this.nImagesInput.value = max.toString();
        }
        console.log('[ImageConsoleTab] Updated n input: max=', max, 'value=', this.nImagesInput.value);
      } else {
        console.warn('[ImageConsoleTab] nImagesInput is undefined');
      }

      // Update quality dropdown
      if (this.qualityDropdown?.parentElement?.parentElement) {
        const qualitySetting = this.qualityDropdown.parentElement.parentElement as HTMLElement;
        const qualities = this.modelQualities[model] || [];
        console.log('[ImageConsoleTab] Qualities for model:', model, qualities);
        if (qualities.length === 0) {
          qualitySetting.style.display = 'none';
          console.log('[ImageConsoleTab] Quality dropdown hidden');
        } else {
          qualitySetting.style.display = 'block';
          const currentQuality = this.qualityDropdown.value || '';
          this.qualityDropdown.innerHTML = '';
          qualities.forEach(q => this.qualityDropdown!.add(new Option(q.charAt(0).toUpperCase() + q.slice(1), q)));
          this.qualityDropdown.value = qualities.includes(currentQuality) ? currentQuality : qualities[0];
          console.log('[ImageConsoleTab] Updated quality dropdown:', this.qualityDropdown.value);
        }
      } else {
        console.warn('[ImageConsoleTab] qualityDropdown or its parent is undefined');
      }

      // Update output format dropdown
      if (this.outputFormatDropdown?.parentElement?.parentElement) {
        const outputFormatSetting = this.outputFormatDropdown.parentElement.parentElement as HTMLElement;
        if (model === 'gpt-image-1') {
          outputFormatSetting.style.display = 'block';
          const currentFormat = this.outputFormatDropdown.value || '';
          this.outputFormatDropdown.innerHTML = '';
          this.outputFormats.forEach(f => this.outputFormatDropdown!.add(new Option(f.toUpperCase(), f)));
          this.outputFormatDropdown.value = this.outputFormats.includes(currentFormat) ? currentFormat : 'png';
          console.log('[ImageConsoleTab] Updated output format dropdown:', this.outputFormatDropdown.value);
        } else {
          outputFormatSetting.style.display = 'none';
          console.log('[ImageConsoleTab] Output format dropdown hidden');
        }
      } else {
        console.warn('[ImageConsoleTab] outputFormatDropdown or its parent is undefined');
      }
    };

    // Trigger updateUI on provider change
    this.providerSelector.onProviderChange((provider: string) => {
      console.log('[ImageConsoleTab] Provider changed to:', provider);
      updateUI();
    });

    // Trigger updateUI on model change
    this.providerSelector.onModelChange((model: string) => {
      console.log('[ImageConsoleTab] Model changed to:', model);
      updateUI();
    });

    const promptRow = fixedSection.createEl('div', { cls: 'ai-console-prompt-section-full' });
    this.promptInput.render(promptRow, () => {});
    const promptTextarea = promptRow.querySelector('textarea');
    if (promptTextarea?.nextElementSibling?.tagName === 'BUTTON') {
      promptTextarea.nextElementSibling.remove();
    }

    const controlsRow = fixedSection.createEl('div', { cls: 'ai-console-controls-row' });

    new Setting(controlsRow)
      .setName('Size')
      .addDropdown(dropdown => {
        this.sizeDropdown = dropdown.selectEl;
        console.log('[ImageConsoleTab] sizeDropdown initialized');
      })
      .controlEl.style.flex = '0 0 auto';

    new Setting(controlsRow)
      .setName('N')
      .addText(text => {
        this.nImagesInput = text.inputEl;
        this.nImagesInput.type = 'number';
        this.nImagesInput.min = '1';
        this.nImagesInput.value = '1';
        this.nImagesInput.style.width = '50px';
      })
      .controlEl.style.flex = '0 0 auto';

    new Setting(controlsRow)
      .setName('Quality')
      .addDropdown(dropdown => {
        this.qualityDropdown = dropdown.selectEl;
        console.log('[ImageConsoleTab] qualityDropdown initialized');
      })
      .controlEl.style.flex = '0 0 auto';

    new Setting(controlsRow)
      .setName('Output Format')
      .addDropdown(dropdown => {
        this.outputFormatDropdown = dropdown.selectEl;
        console.log('[ImageConsoleTab] outputFormatDropdown initialized');
      })
      .controlEl.style.flex = '0 0 auto';

    const runButtonRow = fixedSection.createEl('div', { cls: 'ai-console-run-button-row' });
    const runButton = runButtonRow.createEl('button', { text: 'Run', cls: 'ai-console-run-btn' });
    runButton.addEventListener('click', this.runPrompt.bind(this));

    const scrollableSection = container.createEl('div', { cls: 'ai-console-scrollable-section' });

    const outputSection = scrollableSection.createEl('div', { cls: 'ai-console-output-section' });
    outputSection.createEl('h4', { text: 'Generated Images' });
    this.outputArea = outputSection.createEl('div', { cls: 'ai-console-image-grid' });

    this.promptHistory.render(scrollableSection, this.historyClickHandler.bind(this));
    if (this.updateHistoryCallback) {
      this.updateHistoryCallback();
    }

    this.providerSelector.setProvider('openai', this.defaultModels['openai']);

    console.log('[ImageConsoleTab] Performing initial UI update...');
    updateUI();

    const styleEl = container.createEl('style');
    styleEl.textContent = `
      .ai-console-fixed-section {
        flex-shrink: 0;
      }
      .ai-console-scrollable-section {
        flex: 1;
        overflow-y: auto;
        max-height: 300px;
        padding-bottom: 16px;
      }
      .ai-console-image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      .ai-console-controls-row {
        display: flex;
        overflow-x: auto;
        gap: 16px;
        margin-bottom: 8px;
        padding-bottom: 4px;
        white-space: nowrap;
      }
      .ai-console-controls-row::-webkit-scrollbar {
        height: 8px;
      }
      .ai-console-controls-row::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
      }
      .ai-console-controls-row::-webkit-scrollbar-track {
        background: #333;
      }
      .ai-console-run-button-row {
        display: flex;
        justify-content: center;
        margin-bottom: 16px;
      }
      .ai-console-run-btn {
        background-color: #7d57c1;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      .ai-console-run-btn:hover {
        background-color: #5c3a9e;
      }
    `;
  }

  private async runPrompt() {
    console.log('[ImageConsoleTab] Run button clicked.');

    const provider = this.providerSelector.getSelectedProvider();
    const model = this.providerSelector.getSelectedModel() || this.defaultModels[provider] || 'dall-e-3';
    const prompt = this.promptInput.getPrompt().trim();
    const size = this.sizeDropdown?.value || '1024x1024';
    const n = parseInt(this.nImagesInput?.value || '1', 10) || 1;
    const quality = this.qualityDropdown?.value || (model === 'dall-e-3' ? 'standard' : 'auto');
    const output_format = this.outputFormatDropdown?.value || 'png';

    console.log('[ImageConsoleTab] runPrompt - provider:', provider, 'model:', model, 'prompt:', prompt, 'size:', size, 'n:', n, 'quality:', quality, 'output_format:', output_format);

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

    // Model-specific request fields
    if (model === 'gpt-image-1') {
      request.output_format = output_format;
      if (quality && quality !== 'auto') {
        request.quality = quality; // low, medium, high
      }
    } else {
      request.response_format = 'b64_json';
      if (model === 'dall-e-3' && quality) {
        request.quality = quality; // standard or hd
      }
    }

    console.log('[ImageConsoleTab] Generated request:', request);

    const adapter = (this.imageGateway as any).adapters[provider];
    if (!adapter) {
      new Notice(`No adapter found for provider: ${provider}.`);
      console.error('[ImageConsoleTab] No adapter found for provider:', provider);
      return;
    }

    try {
      if (this.outputArea) {
        this.outputArea.empty();
        this.outputArea.setText('Generating...');
      }

      const result = await adapter.generate(request);

      if (this.outputArea) {
        this.outputArea.empty();
        const renderableUrls: string[] = [];
        result.imageUrls.forEach((url: string) => {
          let imgSrc = url;
          try {
            const binary = atob(url);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              array[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([array], { type: `image/${model === 'gpt-image-1' ? output_format : 'png'}` });
            imgSrc = URL.createObjectURL(blob);
            this.blobUrls.push(imgSrc);
          } catch (e) {
            console.error('[ImageConsoleTab] Failed to decode base64:', e);
            return;
          }
          renderableUrls.push(imgSrc);
          const img = this.outputArea!.createEl('img', {
            attr: { src: imgSrc, style: 'max-width: 100%; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);' },
          });
          img.onerror = () => {
            img.remove();
            this.outputArea!.createEl('p', { text: 'Failed to load image.' });
            if (imgSrc.startsWith('blob:')) {
              URL.revokeObjectURL(imgSrc);
              this.blobUrls = this.blobUrls.filter(u => u !== imgSrc);
            }
          };
          img.onload = () => {
            if (imgSrc.startsWith('blob:')) {
              URL.revokeObjectURL(imgSrc);
              this.blobUrls = this.blobUrls.filter(u => u !== imgSrc);
            }
          };
        });

        const historyEntry: ImageHistoryEntry = {
          provider,
          model,
          prompt,
          imageUrls: renderableUrls,
          timestamp: new Date().toLocaleString(),
          size,
          quality,
          output_format: model === 'gpt-image-1' ? output_format : undefined,
        };

        this.history.unshift(historyEntry);
        if (this.history.length > 10) this.history.pop();
        if (this.addToHistory) this.addToHistory(historyEntry);
        if (this.updateHistoryCallback) this.updateHistoryCallback();

        console.log('[ImageConsoleTab] Image(s) generated:', renderableUrls);
      }
    } catch (error: any) {
      console.error('[ImageConsoleTab] Generation error:', error);
      let errorMessage = error.message || 'Unknown error';
      if (error.message.includes('400')) {
        errorMessage += '. Check model parameters (e.g., gpt-image-1 does not support response_format).';
      }
      new Notice(`Failed to generate image: ${errorMessage}`);
      if (this.outputArea) this.outputArea.setText(`Error: ${errorMessage}`);
    }
  }

  private historyClickHandler(entry: ImageHistoryEntry) {
    this.providerSelector.setProvider(entry.provider, entry.model);
    this.promptInput.setPrompt(entry.prompt);
    if (this.sizeDropdown) this.sizeDropdown.value = entry.size || '1024x1024';
    if (this.qualityDropdown) this.qualityDropdown.value = entry.quality || (entry.model === 'dall-e-3' ? 'standard' : 'auto');
    if (this.outputFormatDropdown && entry.output_format) this.outputFormatDropdown.value = entry.output_format;
    console.log('[ImageConsoleTab] History entry selected:', entry);
  }

  cleanup() {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
    this.blobUrls = [];
    this.providerSelector.cleanup();
    this.promptInput.cleanup();
    this.promptHistory.cleanup();
  }

  renderHistory(history: (ImageHistoryEntry | any)[]) {
    const imageHistory = history.filter((entry): entry is ImageHistoryEntry => 'imageUrls' in entry);
    this.promptHistory.updateHistory(imageHistory, this.historyClickHandler.bind(this));
  }
}