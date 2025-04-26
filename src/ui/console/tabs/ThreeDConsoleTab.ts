import { App } from 'obsidian';
import type { MyPluginSettings } from '../../../settings/settings';
import type { SecretsManager } from '../../../utils/secrets';

export class ThreeDConsoleTab {
  id = '3d';
  name = '3D Playground';
  icon = 'cube';

  constructor(
    private app: App,
    private settings: MyPluginSettings,
    private secrets: SecretsManager
  ) {}

  render(container: HTMLElement) {
    container.createEl('p', { text: '3D Console (Coming Soon)' });
  }

  cleanup() {}
}