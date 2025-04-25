// src/ui/console/tabs/VideoConsoleTab.ts
import { App } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/settings';
import type { SecretsManager } from '../../../utils/secrets';

export class VideoConsoleTab {
  id = 'video';
  name = 'Video Playground';

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager
  ) {}

  render(container: HTMLElement) {
    container.createEl('p', { text: 'Video Console (Coming Soon)' });
  }

  cleanup() {}
}