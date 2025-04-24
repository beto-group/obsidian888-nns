import { App, Vault, normalizePath } from 'obsidian';

// Define the path for the secrets directory and file
const SECRETS_DIR_PATH = '.secrets/nns';
const SECRETS_FILE_PATH = normalizePath(`${SECRETS_DIR_PATH}/secrets.json`);

/**
 * Manages storing and retrieving secrets (like API keys) securely
 * within the Obsidian vault in a dedicated file.
 */
export class SecretsManager {
    private app: App;
    private vault: Vault;
    // In-memory cache of the secrets
    private secrets: Record<string, string> = {};
    // Flag to indicate if secrets have been loaded from the file
    private isLoaded: boolean = false;
    // Promise to ensure loading completes before other operations if needed
    private loadPromise: Promise<void> | null = null;

    /**
     * Creates an instance of SecretsManager.
     * @param app - The Obsidian App instance.
     */
    constructor(app: App) {
        this.app = app;
        this.vault = app.vault;
        // Start loading secrets immediately but don't block constructor
        this.loadPromise = this.loadSecretsFromFile();
    }

    /**
     * Ensures that the initial loading of secrets from the file is complete.
     * Should be called after instantiation and before relying on secrets being present.
     */
    async initialize(): Promise<void> {
        if (!this.loadPromise) {
             // Should not happen with current constructor, but safeguard
            this.loadPromise = this.loadSecretsFromFile();
        }
        // Ensure the promise is awaited only once
        if (this.loadPromise) {
            await this.loadPromise;
        }
        console.log('[SecretsManager] Initialized and secrets loaded.');
    }

    /**
     * Loads secrets from the JSON file in the vault.
     * Creates the directory and file if they don't exist.
     */
    private async loadSecretsFromFile(): Promise<void> {
        try {
            // Ensure directory exists before trying to read the file
            await this.ensureDirectoryExists();

            if (await this.vault.adapter.exists(SECRETS_FILE_PATH)) {
                const content = await this.vault.adapter.read(SECRETS_FILE_PATH);
                if (content) {
                    try {
                        this.secrets = JSON.parse(content);
                        console.log(`[SecretsManager] Secrets loaded from ${SECRETS_FILE_PATH}`);
                    } catch (parseError) {
                        console.error(`[SecretsManager] Error parsing secrets file ${SECRETS_FILE_PATH}. Using empty secrets.`, parseError);
                        this.secrets = {}; // File is corrupted, start fresh
                        // Optionally: Backup corrupted file
                        // await this.vault.adapter.write(SECRETS_FILE_PATH + '.corrupted', content);
                        await this.saveSecretsToFile(); // Overwrite corrupted file with empty object
                    }
                } else {
                    this.secrets = {}; // File exists but is empty
                     console.log(`[SecretsManager] Secrets file ${SECRETS_FILE_PATH} is empty. Initializing empty secrets.`);
                }
            } else {
                console.log(`[SecretsManager] Secrets file not found at ${SECRETS_FILE_PATH}. Initializing empty secrets.`);
                this.secrets = {};
                // Create the file with empty content if it doesn't exist
                await this.saveSecretsToFile();
            }
        } catch (error) {
            console.error(`[SecretsManager] Error loading secrets from ${SECRETS_FILE_PATH}:`, error);
            // Fallback to empty secrets if loading fails
            this.secrets = {};
        } finally {
            this.isLoaded = true;
            this.loadPromise = null; // Loading is complete
        }
    }

    /**
     * Ensures the '.secrets/nns' directory exists.
     */
    private async ensureDirectoryExists(): Promise<void> {
         try {
            // Check if the base '.secrets' directory exists
            const baseDirExists = await this.vault.adapter.exists(normalizePath('.secrets'));
            if (!baseDirExists) {
                console.log("[SecretsManager] Creating base directory '.secrets'");
                await this.vault.adapter.mkdir(normalizePath('.secrets'));
            }
             // Check if the specific 'nns' subdirectory exists
            const nnsDirExists = await this.vault.adapter.exists(SECRETS_DIR_PATH);
             if (!nnsDirExists) {
                console.log(`[SecretsManager] Creating secrets directory at ${SECRETS_DIR_PATH}`);
                await this.vault.adapter.mkdir(SECRETS_DIR_PATH);
            }
        } catch (error) {
            // Ignore errors if directory already exists, log others
             // Vault adapter throws if it exists, so we check the message
            if (!(error instanceof Error && /EEXIST|already exists/i.test(error.message))) {
                 console.error(`[SecretsManager] Error creating directory ${SECRETS_DIR_PATH}:`, error);
                 // Re-throw if it's not an 'already exists' error, as it might be permissions etc.
                 throw error;
            } else {
                 // Log if it already existed, for debugging clarity
                 // console.log(`[SecretsManager] Directory ${SECRETS_DIR_PATH} already exists.`);
            }
        }
    }

    /**
     * Saves the current in-memory secrets to the JSON file in the vault.
     */
    private async saveSecretsToFile(): Promise<void> {
        // No need to wait for loadPromise here, as saving should only happen
        // after initialization or user action, by which time loading is complete.
        // If save is called *during* initial load (unlikely), it might cause issues.
        // Consider adding a queue or lock if concurrent access becomes complex.
         try {
            await this.ensureDirectoryExists(); // Make sure directory exists before writing
            const data = JSON.stringify(this.secrets, null, 2); // Pretty-print JSON
            await this.vault.adapter.write(SECRETS_FILE_PATH, data);
            // console.log(`[SecretsManager] Secrets saved to ${SECRETS_FILE_PATH}`); // Reduce log noise
        } catch (error) {
            console.error(`[SecretsManager] Error saving secrets to ${SECRETS_FILE_PATH}:`, error);
            // Optionally notify the user
            // new Notice('Failed to save secrets. Check console for details.');
        }
    }

    /**
     * Sets (adds or updates) a secret.
     * @param key - The identifier for the secret (e.g., 'openai').
     * @param value - The secret value (e.g., the API key).
     */
    async setSecret(key: string, value: string): Promise<void> {
        if (!key || typeof value !== 'string') {
            console.error('[SecretsManager] Invalid key or value provided for setSecret.');
            return;
        }
        this.secrets[key] = value;
        await this.saveSecretsToFile();
    }

    /**
     * Retrieves a secret by its key.
     * Returns undefined if the key is not found.
     * Ensures secrets are loaded before returning.
     * @param key - The identifier for the secret.
     * @returns The secret value or undefined.
     */
    async getSecret(key: string): Promise<string | undefined> {
         // Ensure initial load is complete before trying to access secrets
         if (!this.isLoaded && this.loadPromise) {
             console.warn('[SecretsManager] Attempted to get secret before initial load completed. Waiting...');
             await this.loadPromise;
         }
        return this.secrets[key];
    }

    /**
     * Deletes a secret by its key.
     * Ensures secrets are loaded before deleting.
     * @param key - The identifier for the secret to delete.
     */
    async deleteSecret(key: string): Promise<void> {
         // Ensure initial load is complete
         if (!this.isLoaded && this.loadPromise) {
             console.warn('[SecretsManager] Attempted to delete secret before initial load completed. Waiting...');
            await this.loadPromise;
        }
        if (this.secrets.hasOwnProperty(key)) {
            delete this.secrets[key];
            await this.saveSecretsToFile();
        } else {
             console.log(`[SecretsManager] Attempted to delete non-existent secret key: ${key}`);
        }
    }

    /**
     * Lists the keys of all stored secrets.
     * Ensures secrets are loaded before listing.
     * @returns An array of secret keys.
     */
    async listSecrets(): Promise<string[]> {
         // Ensure initial load is complete
         if (!this.isLoaded && this.loadPromise) {
             console.warn('[SecretsManager] Attempted to list secrets before initial load completed. Waiting...');
            await this.loadPromise;
        }
        return Object.keys(this.secrets);
    }
}
