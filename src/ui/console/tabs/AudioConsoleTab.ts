// src/ui/console/tabs/AudioConsoleTab.ts
import { App } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/settings';
import type { SecretsManager } from '../../../utils/secrets';

export class AudioConsoleTab {
  id = 'audio';
  name = 'Audio Playground';

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager
  ) {}

  render(container: HTMLElement) {
    container.createEl('p', { text: 'Audio Console (Coming Soon)' });
  }

  cleanup() {}
}
