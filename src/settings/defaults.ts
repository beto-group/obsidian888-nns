import { Category, ProviderConfig, MyPluginSettings } from './types';
import { providerMetadata } from './providers/index';

// Define supported providers per category
export const categoryProviders: Record<Category, string[]> = {
    text: ['openai', 'anthropic', 'groq', 'gemini', 'openrouter', 'grok', 'local'],
    image: ['openai', 'stabilityai', 'grok'],
    video: [], // No providers yet; placeholder for future
    audio: [], // No providers yet
    ocr: [], // No providers yet
    '3D': ['stabilityai'] // Added 3D category with stabilityai as a provider
};

// Dynamically generate DEFAULT_SETTINGS
export const DEFAULT_SETTINGS: MyPluginSettings = {
    categories: {
        text: { defaultProvider: 'openai', backupProvider: '' },
        image: { defaultProvider: 'openai', backupProvider: '' },
        video: { defaultProvider: '', backupProvider: '' },
        audio: { defaultProvider: '', backupProvider: '' },
        ocr: { defaultProvider: '', backupProvider: '' },
        '3D': { defaultProvider: '', backupProvider: '' }
    },
    providers: Object.keys(providerMetadata).reduce((acc, key) => {
        acc[key] = {
            model: providerMetadata[key].defaultModel
        };
        return acc;
    }, {} as Record<string, ProviderConfig>)
};
