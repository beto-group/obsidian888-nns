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

    constructor(
        private app: App,
        private settings: MyPluginSettings,
        private secrets: SecretsManager,
        private addToHistory?: (entry: ImageHistoryEntry) => void,
        private updateHistoryCallback?: () => void
    ) {
        this.providerSelector = new ProviderSelector(app, settings, secrets);
        this.promptInput = new PromptInput();
        this.promptHistory = new PromptHistory();
    }

    async render(container: HTMLElement) {
        console.log('[ImageConsoleTab] Rendering...');
        try {
            this.imageGateway = await ImageGateway.create(this.secrets, this.settings);
            console.log('[ImageConsoleTab] ImageGateway initialized successfully.');
        } catch (error: any) {
            console.error('[ImageConsoleTab] Failed to initialize ImageGateway:', error);
            new Notice('Failed to initialize Image Console.');
            container.createEl('p', { text: 'Error initializing Image Console.' });
            return;
        }

        // Render sections
        this.providerSelector.render(container, undefined);
        this.promptInput.render(container, this.runPrompt.bind(this));

        // Image output area
        const outputSection = container.createEl('div', { cls: 'ai-console-output-section' });
        outputSection.createEl('h4', { text: 'Generated Images' });
        const outputArea = outputSection.createEl('div', { cls: 'ai-console-output' });

        // Size selection
        const sizeSetting = new Setting(container)
            .setName('Image Size')
            .setDesc('Select the size of the generated image.')
            .addDropdown(dropdown => {
                ['256x256', '512x512', '1024x1024'].forEach(size => dropdown.addOption(size, size));
                dropdown.setValue('1024x1024');
            });

        // Render history
        this.promptHistory.render(container, this.historyClickHandler.bind(this));
        if (this.updateHistoryCallback) {
            this.updateHistoryCallback();
        }
    }

    private async runPrompt() {
        console.log('[ImageConsoleTab] Run button clicked.');
        const provider = this.providerSelector.getSelectedProvider();
        const model = this.providerSelector.getSelectedModel() || this.settings.providers[provider]?.model || 'dall-e-3';
        const prompt = this.promptInput.getPrompt().trim();
        const size = (document.querySelector('.ai-console-output-section select') as HTMLSelectElement)?.value || '1024x1024';

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

        const request = { prompt, model, size, n: 1 };
        const adapter = (this.imageGateway as any).adapters[provider];
        if (!adapter) {
            new Notice(`No adapter found for provider: ${provider}.`);
            console.error('[ImageConsoleTab] No adapter found for provider:', provider);
            return;
        }

        try {
            const outputArea = document.querySelector('.ai-console-output') as HTMLElement;
            outputArea.empty();
            outputArea.setText('Generating...');

            const result = await adapter.generate(request);
            outputArea.empty();

            result.imageUrls.forEach((url: string) => {
                const img = outputArea.createEl('img', { attr: { src: url, style: 'max-width: 100%; margin: 10px 0;' } });
                img.onerror = () => {
                    img.remove();
                    outputArea.createEl('p', { text: 'Failed to load image.' });
                };
            });

            const historyEntry: ImageHistoryEntry = {
                provider,
                model,
                prompt,
                imageUrls: result.imageUrls,
                timestamp: new Date().toLocaleString(),
            };
            this.history.unshift(historyEntry);
            if (this.history.length > 10) this.history.pop();
            if (this.addToHistory) this.addToHistory(historyEntry);
            if (this.updateHistoryCallback) this.updateHistoryCallback();

            console.log('[ImageConsoleTab] Image generated:', result.imageUrls);
        } catch (error: any) {
            console.error('[ImageConsoleTab] Generation error:', error);
            new Notice(`Failed to generate image: ${error.message || 'Unknown error'}`);
            const outputArea = document.querySelector('.ai-console-output') as HTMLElement;
            outputArea.setText(`Error: ${error.message || 'Unknown error'}`);
        }
    }

    private historyClickHandler(entry: ImageHistoryEntry) {
        this.providerSelector.setProvider(entry.provider, entry.model);
        this.promptInput.setPrompt(entry.prompt);
    }

    cleanup() {
        this.providerSelector.cleanup();
        this.promptInput.cleanup();
        this.promptHistory.cleanup();
    }

    renderHistory(history: (ImageHistoryEntry | any)[]) {
        const imageHistory = history.filter((entry): entry is ImageHistoryEntry => 'imageUrls' in entry);
        this.promptHistory.updateHistory(imageHistory, this.historyClickHandler.bind(this));
    }
}