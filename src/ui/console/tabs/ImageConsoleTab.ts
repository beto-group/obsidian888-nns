// src/ui/console/tabs/ImageConsoleTab.ts
import { App } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/settings';
import type { SecretsManager } from '../../../utils/secrets';

export class ImageConsoleTab {
  id = 'image';
  name = 'Image Playground';
  icon = 'image';

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager
  ) {}

  render(container: HTMLElement) {
    container.createEl('p', { text: 'Image Console (Coming Soon)' });
  }

  cleanup() {}
}