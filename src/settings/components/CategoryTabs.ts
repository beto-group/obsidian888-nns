import { SampleSettingTab } from '../settings';
import { categoryProviders } from '../defaults';
import { TabComponent, TabConfig } from '../../ui/components/TabComponent';
import { getTabIcon } from '../utils';
import { Setting, Notice } from 'obsidian';
import { Category } from '../types';

export function renderCategoryTabs(tab: SampleSettingTab, containerEl: HTMLElement): void {
    const tabs: TabConfig[] = Object.keys(categoryProviders).map(category => ({
        tab: {
            id: category,
            name: category.charAt(0).toUpperCase() + category.slice(1),
            render: (tabContainer: HTMLElement) => renderCategoryTab(tab, tabContainer, category as Category),
            cleanup: () => {} // No cleanup needed for static settings
        },
        icon: getTabIcon(category)
    }));

    const tabComponent = new TabComponent(tab.app, tabs, 'text');
    const tabContainer = containerEl.createEl('div', { cls: 'category-tabs' });
    tabComponent.render(tabContainer);
}

function renderCategoryTab(tab: SampleSettingTab, container: HTMLElement, category: Category) {
    const catSettings = tab.plugin.settings.categories[category] || {
        defaultProvider: '',
        backupProvider: ''
    };

    // Create settings for default and backup providers
    const createProviderDropdown = (setting: Setting, settingKey: 'defaultProvider' | 'backupProvider') => {
        setting.addDropdown(dropdown => {
            const validProviders = categoryProviders[category]
                .filter(id => tab.workingProviders.has(id));

            dropdown.addOption('', '--- Select ---');

            if (validProviders.length === 0) {
                dropdown.addOption('', 'No validated providers available');
                dropdown.setDisabled(true);
            } else {
                validProviders.forEach(id => dropdown.addOption(id, id));
                dropdown.setDisabled(false);
            }

            const currentValue = catSettings[settingKey];
            dropdown.setValue(validProviders.includes(currentValue) ? currentValue : '');

            dropdown.onChange(async value => {
                const settingName = settingKey === 'defaultProvider' ? 'Default' : 'Backup';
                if (value === '') {
                    new Notice(`Cleared ${settingName} Provider for ${category}.`);
                } else {
                    new Notice(`${settingName} provider for ${category} set to ${value}`);
                }
                catSettings[settingKey] = value;
                await tab.plugin.saveSettings();
            });
        });
    };

    const defaultProviderSetting = new Setting(container)
        .setName(`Default Provider for ${category}`)
        .setDesc(`Primary provider for ${category} (must be validated).`);
    createProviderDropdown(defaultProviderSetting, 'defaultProvider');

    const backupProviderSetting = new Setting(container)
        .setName(`Backup Provider for ${category}`)
        .setDesc(`Used if the default provider for ${category} fails (must be validated).`);
    createProviderDropdown(backupProviderSetting, 'backupProvider');
}