import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { fetchGrokModels } from '../../settings/providers/grok';

/**
 * GrokAdapter implements the LLMAdapter interface for xAI's Grok API.
 * It supports text generation using the xAI API endpoint.
 */
export class GrokAdapter implements LLMAdapter {
  providerKey = 'grok';
  private fallbackModel = 'grok-1'; // Safe default model for xAI Grok

  constructor(
    private apiKey: string,
    private defaultModel: string
  ) {
    console.log('[GrokAdapter] Initialized with default model:', defaultModel);
    console.log('[GrokAdapter] API key provided:', this.apiKey ? '[REDACTED]' : 'None');
  }

  /**
   * Validates the provided model by checking against available xAI models.
   * Returns the provided model if valid, else falls back to defaultModel or a known model.
   */
  private async validateModel(model?: string): Promise<string> {
    console.log('[GrokAdapter] Validating model:', model || 'undefined');
    const candidateModel = model || this.defaultModel;

    try {
      const availableModels = await fetchGrokModels(this.apiKey);
      console.log('[GrokAdapter] Available models:', availableModels);

      if (availableModels.includes(candidateModel)) {
        console.log('[GrokAdapter] Model validated:', candidateModel);
        return candidateModel;
      }

      if (availableModels.includes(this.defaultModel)) {
        console.warn(
          '[GrokAdapter] Invalid model provided:',
          candidateModel,
          'Falling back to default:',
          this.defaultModel
        );
        return this.defaultModel;
      }

      if (availableModels.includes(this.fallbackModel)) {
        console.warn(
          '[GrokAdapter] Both provided model',
          candidateModel,
          'and default model',
          this.defaultModel,
          'are invalid. Falling back to:',
          this.fallbackModel
        );
        return this.fallbackModel;
      }

      console.error('[GrokAdapter] No valid models available:', availableModels);
      throw new Error('No valid Grok models available. Check API key or API status.');
    } catch (error) {
      console.error('[GrokAdapter] Error fetching available models:', error);
      const fallback = this.defaultModel || this.fallbackModel;
      console.warn('[GrokAdapter] Model fetch failed, using fallback model:', fallback);
      return fallback;
    }
  }

  /**
   * Generates text using xAI's chat completions endpoint.
   */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    const model = await this.validateModel(req.model);
    const body = {
      model,
      messages: [
        ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
        { role: 'user', content: req.prompt },
      ],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1000,
    };

    console.log('[GrokAdapter] Sending request:', {
      url: 'https://api.x.ai/v1/chat/completions',
      body: {
        ...body,
        messages: body.messages.map(msg => ({
          ...msg,
          content: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content,
        })),
      },
      headers: { Authorization: '[REDACTED]', 'Content-Type': 'application/json' },
    });

    try {
      const resp = await requestUrl({
        url: 'https://api.x.ai/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (resp.status >= 400) {
        let errorMessage = `Grok error ${resp.status}`;
        try {
          const errorBody = resp.json?.error?.message || resp.text || 'No additional details';
          console.error('[GrokAdapter] Error response body:', errorBody);
          errorMessage += `: ${errorBody}`;
          if (resp.status === 401) {
            errorMessage += '. Invalid API key. Verify your xAI API key in settings at https://x.ai/api.';
          } else if (resp.status === 400) {
            errorMessage += '. Check request parameters or model validity.';
          } else if (resp.status === 429) {
            errorMessage += '. Rate limit exceeded. Try again later or check your xAI account at https://x.ai/api.';
          } else if (resp.status === 403) {
            errorMessage += '. Check your API key permissions or account status at https://x.ai/api.';
          } else if (resp.status >= 500) {
            errorMessage += '. Server error at xAI. Try again later or contact xAI support.';
          }
        } catch {
          errorMessage += ': Failed to parse error details';
        }
        throw new Error(errorMessage);
      }

      const data = resp.json as any;
      if (!data.choices || !Array.isArray(data.choices) || !data.choices[0]?.message?.content) {
        console.error('[GrokAdapter] Unexpected response format:', data);
        throw new Error('Unexpected xAI API response format');
      }

      const output = data.choices[0].message.content.trim();
      const tokensUsed = data.usage?.total_tokens || 0;
      console.log('[GrokAdapter] Response received:', {
        output: output.length > 50 ? output.slice(0, 50) + '...' : output,
        tokensUsed,
        model: data.model,
      });

      return {
        output,
        tokensUsed,
      };
    } catch (error) {
      console.error('[GrokAdapter] Generation error:', error);
      throw error;
    }
  }
}