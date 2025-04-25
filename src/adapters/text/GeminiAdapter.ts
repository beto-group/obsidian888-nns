import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { fetchGeminiModels } from '../../settings/providers/gemini';

/**
 * GeminiAdapter implements the LLMAdapter interface for Google's Gemini API.
 * It supports text generation using the Gemini API endpoint.
 */
export class GeminiAdapter implements LLMAdapter {
  providerKey = 'gemini';
  private fallbackModel = 'gemini-1.5-pro-latest'; // Updated to latest model
  private apiVersions = ['v1', 'v1beta']; // Try both stable and beta

  constructor(
    private apiKey: string,
    private defaultModel: string
  ) {
    console.log('[GeminiAdapter] Initialized with default model:', defaultModel);
    console.log('[GeminiAdapter] API key provided:', this.apiKey ? '[REDACTED]' : 'None');
  }

  /**
   * Validates the provided model by checking against available Gemini models.
   * Returns the provided model if valid, else falls back to defaultModel or a known model.
   */
  private async validateModel(model?: string): Promise<string> {
    console.log('[GeminiAdapter] Validating model:', model || 'undefined');
    const candidateModel = model || this.defaultModel;

    try {
      const availableModels = await fetchGeminiModels(this.apiKey);
      console.log('[GeminiAdapter] Available models:', availableModels);

      // Normalize model names by removing 'models/' prefix
      const normalizedModels = availableModels.map(m => m.replace(/^models\//, ''));
      if (normalizedModels.includes(candidateModel)) {
        console.log('[GeminiAdapter] Model validated:', candidateModel);
        return candidateModel;
      }

      if (normalizedModels.includes(this.defaultModel)) {
        console.warn(
          '[GeminiAdapter] Invalid model provided:',
          candidateModel,
          'Falling back to default:',
          this.defaultModel
        );
        return this.defaultModel;
      }

      if (normalizedModels.includes(this.fallbackModel)) {
        console.warn(
          '[GeminiAdapter] Both provided model',
          candidateModel,
          'and default model',
          this.defaultModel,
          'are invalid. Falling back to:',
          this.fallbackModel
        );
        return this.fallbackModel;
      }

      console.error('[GeminiAdapter] No valid models available:', normalizedModels);
      throw new Error('No valid Gemini models available. Check API key or API status.');
    } catch (error) {
      console.error('[GeminiAdapter] Error fetching available models:', error);
      const fallback = this.defaultModel || this.fallbackModel;
      console.warn('[GeminiAdapter] Model fetch failed, using fallback model:', fallback);
      return fallback;
    }
  }

  /**
   * Generates text using Google's Gemini API.
   */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    const model = await this.validateModel(req.model);
    const body = {
      contents: [
        ...(req.systemPrompt
          ? [{ parts: [{ text: req.systemPrompt }], role: 'system' }]
          : []),
        { parts: [{ text: req.prompt }], role: 'user' },
      ],
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 1000,
      },
    };

    let lastError: Error | null = null;

    for (const apiVersion of this.apiVersions) {
      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${this.apiKey.trim()}`;

      console.log('[GeminiAdapter] Sending request:', {
        url,
        apiVersion,
        model,
        body: {
          contents: body.contents.map(c => ({
            ...c,
            parts: c.parts.map(p => ({
              text: p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text,
            })),
          })),
          generationConfig: body.generationConfig,
        },
        headers: { 'Content-Type': 'application/json' },
      });

      try {
        const resp = await requestUrl({
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (resp.status >= 400) {
          let errorMessage = `Gemini error ${resp.status}`;
          let errorDetails = '';
          try {
            const errorBody = resp.json?.error?.message || resp.text || 'No additional details';
            console.error('[GeminiAdapter] Error response body:', errorBody);
            errorDetails = errorBody;
            errorMessage += `: ${errorBody}`;
            if (resp.status === 401) {
              errorMessage += '. Invalid API key. Verify your Gemini API key in settings at https://aistudio.google.com/app/apikey.';
            } else if (resp.status === 404) {
              errorMessage += `. Model "${model}" not found or endpoint incorrect for API version ${apiVersion} (tried ${url}). Check available models, API version, or region restrictions at https://ai.google.dev/docs.`;
            } else if (resp.status === 400) {
              errorMessage += '. Invalid request parameters. Check prompt or model configuration.';
            } else if (resp.status === 429) {
              errorMessage += '. Rate limit exceeded. Try again later or check your Gemini API quota at https://aistudio.google.com/app/apikey.';
            } else if (resp.status === 403) {
              errorMessage += '. Check your API key permissions or account status at https://aistudio.google.com/app/apikey.';
            } else if (resp.status >= 500) {
              errorMessage += '. Server error at Google. Try again later or contact Google AI support.';
            }
          } catch {
            errorMessage += ': Failed to parse error details';
          }
          lastError = new Error(errorMessage);
          continue;
        }

        const data = resp.json as any;
        if (
          !data.candidates ||
          !Array.isArray(data.candidates) ||
          !data.candidates[0]?.content?.parts?.[0]?.text
        ) {
          console.error('[GeminiAdapter] Unexpected response format:', data);
          throw new Error('Unexpected Gemini API response format');
        }

        const output = data.candidates[0].content.parts[0].text.trim();
        const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
        console.log('[GeminiAdapter] Response received:', {
          output: output.length > 50 ? output.slice(0, 50) + '...' : output,
          tokensUsed,
          model,
          apiVersion,
        });

        return {
          output,
          tokensUsed,
        };
      } catch (error) {
        console.error('[GeminiAdapter] Generation error for API version', apiVersion, ':', {
          error: error.message,
          url,
          modelUsed: model,
          apiKeyPresent: !!this.apiKey,
          requestBody: body.contents.map(c => ({
            ...c,
            parts: c.parts.map(p => ({
              text: p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text,
            })),
          })),
        });
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All API versions failed to generate content');
  }
}