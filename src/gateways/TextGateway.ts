import type { SecretsManager } from '../utils/secrets';
import type { MyPluginSettings } from '../settings/types';
import { providerMetadata } from '../settings/providers/index';
import type { LLMAdapter, LLMRequest } from '../core/Adapter';
import { OpenAIAdapter } from '../adapters/text/OpenAIAdapter';
import { AnthropicAdapter } from '../adapters/text/AnthropicAdapter';
import { GrokAdapter } from '../adapters/text/GrokAdapter';
import { OpenRouterAdapter } from '../adapters/text/OpenRouterAdapter';
import { GeminiAdapter } from '../adapters/text/GeminiAdapter';
import { GroqAdapter } from '../adapters/text/GroqAdapter';

export class TextGateway {
  private adapters: Record<string, LLMAdapter> = {};

  private constructor(
    private defaultProvider: string,
    private backupProvider: string
  ) {}

  /** Factory that reads your settings & secrets and instantiates one adapter per provider */
  static async create(
    secrets: SecretsManager,
    settings: MyPluginSettings
  ): Promise<TextGateway> {
    const gw = new TextGateway(
      settings.categories.text.defaultProvider,
      settings.categories.text.backupProvider
    );

    for (const key of Object.keys(settings.providers)) {
      const model = settings.providers[key].model;
      let apiKey: string | undefined;

      // Grab the key if needed
      if (providerMetadata[key].requiresApiKey) {
        apiKey = await secrets.getSecret(key);
        if (!apiKey) {
          console.warn(`[TextGateway] No API key found for ${key}. Skipping adapter.`);
          continue;
        }
      }

      // Instantiate the right adapter
      let adapter: LLMAdapter;
      switch (key) {
        case 'openai':
          adapter = new OpenAIAdapter(apiKey!, model);
          break;
        case 'anthropic':
          adapter = new AnthropicAdapter(apiKey!, model);
          break;
        case 'grok':
          adapter = new GrokAdapter(apiKey!, model);
          break;
        case 'openrouter':
          adapter = new OpenRouterAdapter(apiKey!, model);
          break;
        case 'gemini':
          adapter = new GeminiAdapter(apiKey!, model);
          break;
        case 'groq':
          adapter = new GroqAdapter(apiKey!, model);
          break;
        default:
          console.warn(`[TextGateway] Unsupported provider: ${key}`);
          continue; // skip unsupported
      }

      console.log(`[TextGateway] Adapter created for ${key} with model: ${model}`);
      gw.adapters[key] = adapter;
    }

    console.log('[TextGateway] Initialized adapters:', Object.keys(gw.adapters));
    return gw;
  }

  /** Single entry point: try default, then fallback */
  async generate(request: LLMRequest): Promise<string> {
    const primary = this.adapters[this.defaultProvider];
    try {
      if (!primary) {
        throw new Error(`No adapter found for default provider: ${this.defaultProvider}`);
      }
      const res = await primary.generate(request);
      return res.output;
    } catch (err) {
      if (
        this.backupProvider &&
        this.adapters[this.backupProvider]
      ) {
        console.log(`[TextGateway] Falling back to backup provider: ${this.backupProvider}`);
        const fallback = await this.adapters[
          this.backupProvider
        ].generate(request);
        return fallback.output;
      }
      throw err;
    }
  }
}