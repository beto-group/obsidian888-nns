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

import { SecretsManager } from './src/utils/secrets';
import { AiConsoleModal } from './src/ui/console/AiConsoleModal';
import { registerAiNNS, unregisterAiNNS } from './src/api/aiNNS';

/**
 * Main Plugin Class
 */
export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    secrets: SecretsManager;

    /**
     * Plugin entry point
     */
    async onload() {
        console.log('[MyPlugin] Loading plugin...');

        // Initialize SecretsManager and wait for it to load secrets from file
        this.secrets = new SecretsManager(this.app);
        await this.secrets.initialize();

        // Log stored secrets for debugging
        try {
            const storedSecrets = await this.secrets.listSecrets();
            console.log('[MyPlugin] Stored secret keys on load:', storedSecrets);
        } catch (error) {
            console.error("[MyPlugin] Error listing secrets on load:", error);
        }

        // Load plugin settings
        await this.loadSettings();

        // Example usage: Try to get a secret
        try {
            const openai = await this.secrets.getSecret("openai");
            if (openai) {
                console.log("[MyPlugin] Found OpenAI Secret on load (length):", openai.length);
            }
        } catch (error) {
            console.error("[MyPlugin] Error getting OpenAI secret on load:", error);
        }

        // Register aiNNS API on global scope
        try {
            await registerAiNNS(this.app, this.secrets, this.settings);
            console.log('[MyPlugin] aiNNS API registered successfully.');
        } catch (error) {
            console.error('[MyPlugin] Error registering aiNNS API:', error);
        }

        // --- UI and Commands ---

        // Add ribbon icon (opens AI Console)
        const ribbonIconEl = this.addRibbonIcon('rocket', 'Open AI Console', (evt: MouseEvent) => {
            try {
                new AiConsoleModal(this.app, this.settings, this.secrets).open();
            } catch (error) {
                console.error('[MyPlugin] Error opening AiConsoleModal from ribbon:', error);
                new Notice('Failed to open AI Console Modal.');
            }
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
                return false;
            }
        });

        // Add command to open AiConsoleModal
        this.addCommand({
            id: 'open-ai-console-modal',
            name: 'Open AI Console Modal',
            callback: () => {
                try {
                    new AiConsoleModal(this.app, this.settings, this.secrets).open();
                } catch (error) {
                    console.error('[MyPlugin] Error opening AiConsoleModal:', error);
                    new Notice('Failed to open AI Console Modal.');
                }
            }
        });

        // Add settings tab
        this.addSettingTab(new SampleSettingTab(this.app, this, this.secrets));

        // Register global DOM event
        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            // console.log('[MyPlugin] DOM click', evt);
        });

        // Register interval task
        this.registerInterval(window.setInterval(() => {
            // console.log('[MyPlugin] Interval running');
        }, 5 * 60 * 1000));

        console.log('[MyPlugin] Plugin loaded successfully.');
    }

    /**
     * Called when plugin is unloaded
     */
    onunload() {
        console.log('[MyPlugin] Unloaded');
        // Unregister aiNNS API to clean up global scope
        unregisterAiNNS();
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
