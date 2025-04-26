export type Category = 'text' | 'image' | 'video' | 'audio' | 'ocr' | '3D';

export interface ProviderConfig {
    model: string;
}

export interface CategorySettings {
    defaultProvider: string;
    backupProvider: string;
}

export interface MyPluginSettings {
    categories: Record<Category, CategorySettings>;
    providers: Record<string, ProviderConfig>;
}