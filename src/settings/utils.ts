import { SampleSettingTab } from './settings';
import { providerMetadata } from './providers/index';
import { ProviderConfig } from './types';

export function ensureProviderConfigExists(tab: SampleSettingTab, providerKey: string): ProviderConfig | undefined {
    if (!providerKey) return undefined;

    const meta = providerMetadata[providerKey];
    if (!meta) {
        console.error(`[Settings] No metadata found for provider key: ${providerKey}`);
        return undefined;
    }

    if (!tab.plugin.settings.providers[providerKey]) {
        tab.plugin.settings.providers[providerKey] = {
            model: meta.defaultModel
        };
        console.log(`[Settings] Added missing provider configuration for: ${providerKey}`);
    }
    return tab.plugin.settings.providers[providerKey];
}

export function getTabIcon(category: string): string {
    const tabIcons: Record<string, string> = {
        text: 'text',
        image: 'image',
        video: 'video',
        audio: 'volume-2',
        ocr: 'scan',
        '3D': 'cube'
    };
    return tabIcons[category] || 'circle';
}