// src/ui/console/tabs/OcrConsoleTab.ts
import { App } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/settings';
import type { SecretsManager } from '../../../utils/secrets';

export class OcrConsoleTab {
  id = 'ocr';
  name = 'OCR Playground';

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager
  ) {}

  render(container: HTMLElement) {
    container.createEl('p', { text: 'OCR Console (Coming Soon)' });
  }

  cleanup() {}
}