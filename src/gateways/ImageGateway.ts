// src/gateways/ImageGateway.ts
import type { SecretsManager } from '../utils/secrets';
import type { MyPluginSettings } from '../settings/types';
import { providerMetadata } from '../settings/providers/index';
import type { ImageAdapter, ImageRequest, ImageResponse } from '../core/Adapter';
import { OpenAIImageAdapter } from '../adapters/image/OpenAIImageAdapter';

export class ImageGateway {
  private adapters: Record<string, ImageAdapter> = {};

  private constructor(
    private defaultProvider: string,
    private backupProvider: string
  ) {}

  static async create(
    secrets: SecretsManager,
    settings: MyPluginSettings
  ): Promise<ImageGateway> {
    const gw = new ImageGateway(
      settings.categories.image.defaultProvider,
      settings.categories.image.backupProvider
    );

    for (const key of Object.keys(settings.providers)) {
      if (!['openai', 'stabilityai', 'grok'].includes(key)) {
        console.warn(`[ImageGateway] Skipping provider ${key}: Not an image-capable provider.`);
        continue;
      }

      if (!providerMetadata[key]) {
        console.warn(`[ImageGateway] Skipping provider ${key}: Not found in providerMetadata.`);
        continue;
      }

      const model = settings.providers[key].model;
      let apiKey: string | undefined;

      if (providerMetadata[key].requiresApiKey) {
        apiKey = await secrets.getSecret(key);
        if (!apiKey) {
          console.warn(`[ImageGateway] No API key found for ${key}. Skipping adapter.`);
          continue;
        }
      }

      let adapter: ImageAdapter;
      switch (key) {
        case 'openai':
          adapter = new OpenAIImageAdapter(apiKey!, model);
          break;
        default:
          console.warn(`[ImageGateway] Unsupported image provider: ${key}`);
          continue;
      }

      console.log(`[ImageGateway] Adapter created for ${key} with model: ${model}`);
      gw.adapters[key] = adapter;
    }

    console.log('[ImageGateway] Initialized adapters:', Object.keys(gw.adapters));
    return gw;
  }

  async generate(request: ImageRequest): Promise<ImageResponse> {
    const primary = this.adapters[this.defaultProvider];
    try {
      if (!primary) {
        throw new Error(`No adapter found for default provider: ${this.defaultProvider}`);
      }
      return await primary.generate(request);
    } catch (err) {
      if (this.backupProvider && this.adapters[this.backupProvider]) {
        console.log(`[ImageGateway] Falling back to backup provider: ${this.backupProvider}`);
        return await this.adapters[this.backupProvider].generate(request);
      }
      throw err;
    }
  }
}