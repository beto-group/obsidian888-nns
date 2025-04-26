import { Notice } from 'obsidian'; // Added import for Notice
import { SampleSettingTab } from './settings';
import { providerFetchers, providerMetadata } from './providers/index';
import { ensureProviderConfigExists } from './utils'; // Fixed import

export async function validateAllStoredSecrets(tab: SampleSettingTab): Promise<void> {
    if (tab.isValidating) return;
    tab.isValidating = true;
    console.log("[Settings] Starting initial validation of all stored secrets...");

    tab.workingProviders.clear();
    tab.availableModels = {};

    let storedKeys: string[] = [];
    try {
        storedKeys = await tab.secrets.listSecrets();
        console.log("[Settings] Stored secret keys found:", storedKeys);
    } catch (error) {
        console.error("[Settings] Failed to list secrets during validation:", error);
        tab.isValidating = false;
        return;
    }

    let settingsChanged = false;

    const validationPromises = Object.keys(providerMetadata).map(async (providerKey) => {
        const meta = providerMetadata[providerKey];
        const requiresApiKey = meta.requiresApiKey;
        const hasStoredSecret = storedKeys.includes(providerKey);

        ensureProviderConfigExists(tab, providerKey);

        if (!requiresApiKey) {
            tab.workingProviders.add(providerKey);
            console.log(`[Settings] Added non-API-key provider: ${providerKey}`);
            try {
                const models = await fetchAvailableModels(tab, providerKey, undefined);
                tab.availableModels[providerKey] = models;
                if (models.length > 0) {
                    const currentModel = tab.plugin.settings.providers[providerKey]?.model;
                    if (!currentModel || !models.includes(currentModel)) {
                        console.log(`[Settings] Resetting model for ${providerKey} to ${models[0]}`);
                        tab.plugin.settings.providers[providerKey].model = models[0];
                        settingsChanged = true;
                    }
                } else {
                    console.warn(`[Settings] No models found for non-API-key provider: ${providerKey}`);
                }
            } catch (error) {
                console.error(`[Settings] Error fetching models for non-API-key provider ${providerKey}:`, error);
                tab.availableModels[providerKey] = [];
            }
            return;
        }

        if (hasStoredSecret) {
            let apiKey: string | undefined;
            try {
                apiKey = await tab.secrets.getSecret(providerKey);
            } catch (error) {
                console.error(`[Settings] Failed to get secret for ${providerKey}:`, error);
                return;
            }

            if (apiKey) {
                console.log(`[Settings] Auto-validating stored secret for: ${providerKey}`);
                try {
                    const models = await fetchAvailableModels(tab, providerKey, apiKey);
                    tab.availableModels[providerKey] = models;

                    if (models.length > 0) {
                        tab.workingProviders.add(providerKey);
                        const currentModel = tab.plugin.settings.providers[providerKey]?.model;
                        if (!currentModel || !models.includes(currentModel)) {
                            console.log(`[Settings] Resetting model for ${providerKey} to ${models[0]}`);
                            tab.plugin.settings.providers[providerKey].model = models[0];
                            settingsChanged = true;
                        }
                        console.log(`[Settings] Auto-validation successful for: ${providerKey}`);
                    } else {
                        console.log(`[Settings] Auto-validation failed for stored secret: ${providerKey}. Needs manual re-validation.`);
                    }
                } catch (error) {
                    console.error(`[Settings] Auto-validation model fetch error for ${providerKey}:`, error);
                    tab.availableModels[providerKey] = [];
                }
            } else {
                console.warn(`[Settings] Secret listed for ${providerKey} but getSecret returned undefined.`);
                tab.availableModels[providerKey] = [];
            }
        } else {
            console.log(`[Settings] No stored secret found for API key provider: ${providerKey}`);
            tab.availableModels[providerKey] = [];
        }
    });

    await Promise.all(validationPromises);

    if (settingsChanged) {
        await tab.plugin.saveSettings();
    }

    tab.isValidating = false;
    tab.hasDoneInitialValidation = true;
    console.log("[Settings] Finished initial validation. Working providers:", Array.from(tab.workingProviders));

    tab.display();
}

export async function fetchAvailableModels(
    tab: SampleSettingTab,
    providerKey: string,
    apiKey: string | undefined
): Promise<string[]> {
    const fetcher = providerFetchers[providerKey];
    const meta = providerMetadata[providerKey];

    if (!meta) {
        console.error(`[Settings] No metadata found for provider: ${providerKey}`);
        return [];
    }
    if (meta.requiresApiKey && !apiKey) {
        console.warn(`[Settings] fetchAvailableModels called for ${providerKey} which requires an API key, but none was provided.`);
        return [];
    }
    if (!fetcher) {
        new Notice(`Model fetching not implemented for provider: ${providerKey}`);
        console.warn(`Model fetching not implemented for provider: ${providerKey}`);
        return [];
    }

    try {
        const models = await fetcher(apiKey || '', tab.plugin.app);
        return Array.isArray(models) ? models : [];
    } catch (err) {
        console.error(`[${providerKey}] Model fetch error during fetchAvailableModels:`, err);
        throw err;
    }
}