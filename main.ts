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

import { SecretsManager } from './src/utils/secrets'; // Correct path

/**
 * Main Plugin Class
 */
export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    secrets: SecretsManager; // Instance of SecretsManager

    /**
     * Plugin entry point
     */
    async onload() {
        console.log('[MyPlugin] Loading plugin...');

        // Initialize SecretsManager and wait for it to load secrets from file
        this.secrets = new SecretsManager(this.app);
        await this.secrets.initialize(); // <-- Important: Wait for secrets to load

        // Log stored secrets for debugging (now safe after initialize)
        try {
             const storedSecrets = await this.secrets.listSecrets();
             console.log('[MyPlugin] Stored secret keys on load:', storedSecrets);
        } catch (error) {
            console.error("[MyPlugin] Error listing secrets on load:", error);
        }


        // Load plugin settings
        await this.loadSettings();

        // Example usage: Try to get a secret (safe after initialize)
        try {
            const openai = await this.secrets.getSecret("openai");
            if (openai) {
                 console.log("[MyPlugin] Found OpenAI Secret on load (length):", openai.length); // Avoid logging the actual key
            } else {
                // console.log("[MyPlugin] OpenAI Secret not found on load."); // Reduce noise
            }
        } catch (error) {
             console.error("[MyPlugin] Error getting OpenAI secret on load:", error);
        }


        // --- Rest of your onload logic ---

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
                return false; // Added return false for clarity
            }
        });

        // Add settings tab - Pass the initialized SecretsManager instance
        this.addSettingTab(new SampleSettingTab(this.app, this, this.secrets));

        // Register global DOM event
        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            // console.log('[MyPlugin] DOM click', evt); // Reduced logging verbosity
        });

        // Register interval task
        this.registerInterval(window.setInterval(() => {
            // console.log('[MyPlugin] Interval running'); // Reduced logging verbosity
        }, 5 * 60 * 1000));

        console.log('[MyPlugin] Plugin loaded successfully.');
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