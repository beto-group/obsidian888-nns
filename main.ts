import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin
} from 'obsidian';

import {
	MyPluginSettings,
	DEFAULT_SETTINGS,
	SampleSettingTab
} from './src/settings/settings';

/**
 * Main Plugin Class
 */
export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	/**
	 * Plugin entry point
	 */
	async onload() {
		console.log('[MyPlugin] Loaded');

		// Load plugin settings
		await this.loadSettings();

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			new Notice('This is a notice!');
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Add status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// Simple modal command
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		// Editor command
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log('[MyPlugin] Selected Text:', editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

		// Complex checkable command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						new SampleModal(this.app).open();
					}
					return true;
				}
			}
		});

		// Add settings tab
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Register global DOM event
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('[MyPlugin] DOM click', evt);
		});

		// Register interval task
		this.registerInterval(window.setInterval(() => {
			console.log('[MyPlugin] Interval running');
		}, 5 * 60 * 1000));
	}

	/**
	 * Called when plugin is unloaded
	 */
	onunload() {
		console.log('[MyPlugin] Unloaded');
	}

	/**
	 * Load plugin settings
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Save plugin settings
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/**
 * Basic modal class
 */
class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
