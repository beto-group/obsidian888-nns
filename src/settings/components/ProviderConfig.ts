import { SampleSettingTab } from '../settings';
import { providerMetadata, providerFetchers } from '../providers/index';
import { ensureProviderConfigExists } from '../utils';
import { fetchAvailableModels } from '../validation'; // Fixed import
import { Setting, Notice } from 'obsidian';
import { renderRemoveKeyButton } from './RemoveKeyButton';

export function renderProviderConfig(tab: SampleSettingTab, containerEl: HTMLElement): void {
    const selectedMeta = providerMetadata[tab.selectedProviderKey];
    const currentConfig = ensureProviderConfigExists(tab, tab.selectedProviderKey);
    if (!currentConfig) {
        containerEl.createEl('p', { text: `Error: Configuration could not be created for ${tab.selectedProviderKey}.` });
        return;
    }

    containerEl.createEl('h4', { text: `Configure: ${selectedMeta.key}` });

    // --- API Key Input + Validation Button ---
    const apiKeySetting = new Setting(containerEl);
    const requiresApiKey = selectedMeta.requiresApiKey;

    apiKeySetting.setName(`${selectedMeta.key} API Key`)
        .setDesc(requiresApiKey
            ? `Enter/update key and click Validate.`
            : `This provider does not require an API key.`);

    let apiKeyInput: HTMLInputElement | null = null;

    if (requiresApiKey) {
        apiKeySetting.addText(text => {
            apiKeyInput = text.inputEl;
            text.setPlaceholder('Enter API key here')
                .setValue('')
                .onChange(async value => {});
            text.inputEl.type = 'password';
            text.inputEl.style.width = '300px';
        });
    }

    apiKeySetting.addExtraButton(btn => {
        btn.setIcon('refresh-ccw')
            .setTooltip(requiresApiKey
                ? `Validate ${selectedMeta.key} key & fetch models`
                : 'Fetch available models (no API key needed)')
            .onClick(async () => {
                let apiKeyToValidate: string | undefined = undefined;
                const currentProvider = tab.selectedProviderKey;

                if (requiresApiKey) {
                    if (!apiKeyInput) return;
                    apiKeyToValidate = apiKeyInput.value.trim();
                    if (!apiKeyToValidate) {
                        apiKeyToValidate = await tab.secrets.getSecret(currentProvider);
                        if (!apiKeyToValidate) {
                            new Notice(`API Key required for ${currentProvider}. Enter one or check storage.`, 5000);
                            return;
                        }
                        new Notice(`Re-validating stored key for ${currentProvider}...`);
                    } else {
                        new Notice(`Validating new key for ${currentProvider}...`);
                        await tab.secrets.setSecret(currentProvider, apiKeyToValidate);
                        console.log(`[Settings] Saved new API key for ${currentProvider} before validation.`);
                    }
                } else {
                    new Notice(`Fetching models for ${currentProvider}...`);
                }

                btn.setDisabled(true);
                tab.workingProviders.delete(currentProvider);

                try {
                    const models = await fetchAvailableModels(tab, currentProvider, apiKeyToValidate);
                    tab.availableModels[currentProvider] = models;

                    if (models.length > 0) {
                        tab.workingProviders.add(currentProvider);
                        new Notice(`${currentProvider}: ${models.length} model(s) found. ${requiresApiKey ? 'Key validated!' : 'Models fetched!'}`, 5000);

                        const config = ensureProviderConfigExists(tab, currentProvider);
                        if (config && (!models.includes(config.model))) {
                            config.model = models[0];
                            new Notice(`Model reset to ${models[0]} as previous was unavailable.`, 3000);
                            await tab.plugin.saveSettings();
                        }
                    } else {
                        new Notice(`${currentProvider}: Validation failed. No models found${requiresApiKey ? ' or invalid API key' : ''}. Check console.`, 5000);
                    }
                } catch (error) {
                    console.error(`[Settings] Manual validation error for ${currentProvider}:`, error);
                    tab.availableModels[currentProvider] = [];
                    new Notice(`${currentProvider}: Validation failed. ${error.message}`, 7000);
                } finally {
                    btn.setDisabled(false);
                    tab.display();
                }
            });

        const statusContainer = btn.extraSettingsEl.createSpan({ cls: "setting-item-description" });
        statusContainer.style.marginLeft = "10px";

        if (tab.workingProviders.has(tab.selectedProviderKey)) {
            statusContainer.setText("✅ Valid");
            statusContainer.style.color = "green";
        } else if (requiresApiKey) {
            tab.secrets.getSecret(tab.selectedProviderKey).then(storedKey => {
                if (tab.selectedProviderKey === selectedMeta.key) {
                    if (storedKey) {
                        statusContainer.setText("❓ Validation Needed / Failed");
                        statusContainer.style.color = "orange";
                    } else {
                        statusContainer.setText("❌ No Key Set");
                        statusContainer.style.color = "red";
                    }
                }
            }).catch(err => {
                console.error("Error checking secret for status:", err);
                statusContainer.setText("⚠️ Error checking key");
                statusContainer.style.color = "red";
            });
        } else {
            if (tab.availableModels[tab.selectedProviderKey]?.length > 0) {
                statusContainer.setText("✅ Models Fetched");
                statusContainer.style.color = "green";
            } else {
                statusContainer.setText("❓ Fetch Models");
                statusContainer.style.color = "orange";
            }
        }
    });

    // --- Model Selection Dropdown ---
    const modelSetting = new Setting(containerEl)
        .setName(`${selectedMeta.key} Model`)
        .setDesc(`Select the model for ${selectedMeta.key}. (List updated after validation)`);

    modelSetting.addDropdown(dropdown => {
        const modelOptions = tab.availableModels[tab.selectedProviderKey] ?? [];
        const defaultModel = selectedMeta.defaultModel;
        let optionsToShow = [...modelOptions];

        const currentSelectedModel = currentConfig.model;
        if (currentSelectedModel && !optionsToShow.includes(currentSelectedModel)) {
            optionsToShow.push(currentSelectedModel);
        }
        if (optionsToShow.length === 0 && defaultModel) {
            optionsToShow.push(defaultModel);
        }

        optionsToShow.sort();

        if (optionsToShow.length === 0) {
            dropdown.addOption('', 'No models available (Validate key/Fetch first)');
            dropdown.setDisabled(true);
        } else {
            optionsToShow.forEach(m => dropdown.addOption(m, m));
            dropdown.setDisabled(false);
        }

        dropdown.setValue(optionsToShow.includes(currentSelectedModel) ? currentSelectedModel : optionsToShow[0] || '');

        dropdown.onChange(async value => {
            currentConfig.model = value;
            await tab.plugin.saveSettings();
            new Notice(`${selectedMeta.key} model set to ${value}`);
        });
    });

    // --- Display Fetched Models ---
    const currentModels = tab.availableModels[tab.selectedProviderKey] ?? [];
    if (currentModels.length > 0) {
        const detailsEl = containerEl.createEl('details');
        detailsEl.createEl('summary', { text: `View ${currentModels.length} Available Models` });
        const listEl = detailsEl.createEl('ul', { cls: 'provider-model-list' });
        const modelsToShow = currentModels.slice(0, 25);
        modelsToShow.forEach(model => {
            listEl.createEl('li', { text: model });
        });
        if (currentModels.length > 25) {
            listEl.createEl('li', { text: `... and ${currentModels.length - 25} more.` });
        }
    }

    // --- Remove Configuration Button ---
    renderRemoveKeyButton(tab, containerEl);
}