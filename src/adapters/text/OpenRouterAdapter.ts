import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { fetchOpenRouterModels } from '../../settings/providers/openrouter';

/**
 * OpenRouterAdapter implements the LLMAdapter interface for OpenRouter's API.
 * It supports text generation using the /api/v1/chat/completions endpoint.
 */
export class OpenRouterAdapter implements LLMAdapter {
  providerKey = 'openrouter';
  private fallbackModel = 'x-ai/grok-beta'; // Safe default from OpenRouter

  constructor(
    private apiKey: string,
    private defaultModel: string
  ) {
    console.log('[OpenRouterAdapter] Initialized with default model:', defaultModel);
  }

  private async validateModel(model?: string): Promise<string> {
    console.log('[OpenRouterAdapter] Validating model:', model || 'undefined');
    const candidateModel = model || this.defaultModel;

    try {
      const availableModels = await fetchOpenRouterModels(this.apiKey);
      console.log('[OpenRouterAdapter] Available models:', availableModels);

      if (availableModels.includes(candidateModel)) {
        console.log('[OpenRouterAdapter] Model validated:', candidateModel);
        return candidateModel;
      }

      if (availableModels.includes(this.defaultModel)) {
        console.warn(
          '[OpenRouterAdapter] Invalid model provided:',
          candidateModel,
          'Falling back to default:',
          this.defaultModel
        );
        return this.defaultModel;
      }

      if (availableModels.includes(this.fallbackModel)) {
        console.warn(
          '[OpenRouterAdapter] Both provided model',
          candidateModel,
          'and default model',
          this.defaultModel,
          'are invalid. Falling back to:',
          this.fallbackModel
        );
        return this.fallbackModel;
      }

      console.error('[OpenRouterAdapter] No valid models available:', availableModels);
      throw new Error('No valid OpenRouter models available. Check API key or API status.');
    } catch (error) {
      console.error('[OpenRouterAdapter] Error fetching available models:', error);
      const fallback = this.defaultModel || this.fallbackModel;
      console.warn('[OpenRouterAdapter] Model fetch failed, using fallback model:', fallback);
      return fallback;
    }
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const model = req.model || this.defaultModel;
    const body = {
      model,
      messages: [
        ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
        { role: 'user', content: req.prompt }
      ],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1000
    };
  
    const resp = await requestUrl({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  
    const json = resp.json;
  
    if (!json.choices || !Array.isArray(json.choices)) {
      console.error('[OpenRouterAdapter] Unexpected response format:', json);
      throw new Error('Unexpected OpenRouter API response format');
    }
  
    const content = json.choices[0]?.message?.content ?? '';
    const tokensUsed = json.usage?.total_tokens;
  
    return {
      output: content,
      tokensUsed
    };
  }
}  