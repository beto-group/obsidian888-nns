import { SampleSettingTab } from '../settings';
import { providerMetadata } from '../providers/index';
import { ensureProviderConfigExists } from '../utils';
import { Setting } from 'obsidian';

export function renderProviderSelector(tab: SampleSettingTab, containerEl: HTMLElement): void {
    new Setting(containerEl)
        .setName('Select Provider to Configure')
        .setDesc('Choose a provider to set its API key (if required) and model.')
        .addDropdown(dropdown => {
            Object.keys(providerMetadata).forEach(providerKey =>
                dropdown.addOption(providerKey, providerKey)
            );

            if (!providerMetadata[tab.selectedProviderKey]) {
                tab.selectedProviderKey = Object.keys(providerMetadata)[0] || '';
            }

            dropdown.setValue(tab.selectedProviderKey);

            dropdown.onChange(value => {
                tab.selectedProviderKey = value;
                ensureProviderConfigExists(tab, tab.selectedProviderKey);
                tab.display();
            });
        });
}