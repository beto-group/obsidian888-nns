import { SampleSettingTab } from '../settings';
import { providerMetadata } from '../providers/index';
import { Setting, Notice } from 'obsidian';
import { Category } from '../types';

export function renderRemoveKeyButton(tab: SampleSettingTab, containerEl: HTMLElement): void {
    tab.secrets.getSecret(tab.selectedProviderKey).then(storedKey => {
        const selectedMeta = providerMetadata[tab.selectedProviderKey];
        if (tab.selectedProviderKey === selectedMeta.key && storedKey) {
            new Setting(containerEl)
                .setName(`Remove ${selectedMeta.key} API Key`)
                .setDesc(`Removes the stored API key for ${selectedMeta.key}. The model selection will be kept.`)
                .addButton(btn => {
                    btn.setButtonText('Remove Key')
                        .setIcon('trash')
                        .setWarning()
                        .onClick(async () => {
                            const providerToDelete = tab.selectedProviderKey;
                            new Notice(`Removing API key for ${providerToDelete}...`);

                            await tab.secrets.deleteSecret(providerToDelete);

                            tab.workingProviders.delete(providerToDelete);
                            tab.availableModels[providerToDelete] = [];

                            // Reset default/backup providers for affected categories
                            Object.keys(tab.plugin.settings.categories).forEach(category => {
                                const catSettings = tab.plugin.settings.categories[category as Category];
                                if (catSettings.defaultProvider === providerToDelete) {
                                    catSettings.defaultProvider = '';
                                    new Notice(`Default provider for ${category} cleared as its key was removed.`, 3000);
                                }
                                if (catSettings.backupProvider === providerToDelete) {
                                    catSettings.backupProvider = '';
                                    new Notice(`Backup provider for ${category} cleared as its key was removed.`, 3000);
                                }
                            });

                            await tab.plugin.saveSettings();
                            new Notice(`${providerToDelete} API key removed.`);

                            tab.display();
                        });
                });
        }
    }).catch(err => console.error("Error checking secret for remove button:", err));
}