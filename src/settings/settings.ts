import { App, PluginSettingTab, Setting } from 'obsidian';
import type MyPlugin from '../../main';

export interface MyPluginSettings {
	provider: string;
	apiKey: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	provider: 'openai',
	apiKey: ''
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('AI Provider')
			.setDesc('Select the AI provider to use.')
			.addDropdown(dropdown => dropdown
				.addOption('openai', 'OpenAI')
				.addOption('anthropic', 'Anthropic')
				.addOption('google', 'Google')
				.setValue(this.plugin.settings.provider)
				.onChange(async (value) => {
					this.plugin.settings.provider = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Enter your API key for the selected provider.')
			.addText(text => {
				text.setPlaceholder('Enter your API key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});
	}
}
