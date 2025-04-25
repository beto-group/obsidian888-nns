import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { fetchAnthropicModels } from '../../settings/providers/anthropic';

/**
 * AnthropicAdapter implements the LLMAdapter interface for Anthropic's API.
 * It supports text generation using the /v1/messages endpoint and ensures
 * compatibility with any valid Anthropic model by validating against available models.
 */
export class AnthropicAdapter implements LLMAdapter {
  providerKey = 'anthropic';
  private apiVersion = '2023-06-01'; // Stable Anthropic API version
  private fallbackModel = 'claude-3-5-sonnet-latest'; // Safe default model

  constructor(
    private apiKey: string,
    private defaultModel: string
  ) {}

  /**
   * Validates the provided model by checking against available Anthropic models.
   * Returns the provided model if valid, else falls back to defaultModel or a known model.
   * @param model - The model to validate.
   * @returns A valid model ID.
   */
  private async validateModel(model?: string): Promise<string> {
    console.log('[AnthropicAdapter] Validating model:', model || 'undefined');

    // If no model is provided, use the default
    const candidateModel = model || this.defaultModel;

    try {
      const availableModels = await fetchAnthropicModels(this.apiKey);
      console.log('[AnthropicAdapter] Available models:', availableModels);

      // Check if the candidate model is in the available models
      if (availableModels.includes(candidateModel)) {
        console.log('[AnthropicAdapter] Model validated:', candidateModel);
        return candidateModel;
      }

      // If the candidate model is invalid, check if defaultModel is valid
      if (availableModels.includes(this.defaultModel)) {
        console.warn(
          '[AnthropicAdapter] Invalid model provided:',
          candidateModel,
          'Falling back to default:',
          this.defaultModel
        );
        return this.defaultModel;
      }

      // If both provided and default models are invalid, fall back to a known model
      if (availableModels.includes(this.fallbackModel)) {
        console.warn(
          '[AnthropicAdapter] Both provided model',
          candidateModel,
          'and default model',
          this.defaultModel,
          'are invalid. Falling back to:',
          this.fallbackModel
        );
        return this.fallbackModel;
      }

      // If no valid models are found, throw an error
      console.error('[AnthropicAdapter] No valid models available:', availableModels);
      throw new Error('No valid Anthropic models available. Check API key or API status.');
    } catch (error) {
      console.error('[AnthropicAdapter] Error fetching available models:', error);
      // If model fetch fails, fall back to defaultModel or fallbackModel
      const fallback = this.defaultModel || this.fallbackModel;
      console.warn('[AnthropicAdapter] Model fetch failed, using fallback model:', fallback);
      return fallback;
    }
  }

  /**
   * Generates text using Anthropic's /v1/messages endpoint.
   * Validates the model and constructs a proper request body.
   * @param req - The LLM request containing prompt, model, and other parameters.
   * @returns The generated text and token usage.
   */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    // Validate the model
    const model = await this.validateModel(req.model);

    // Construct the request body
    const body = {
      model,
      messages: [
        ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
        { role: 'user', content: req.prompt },
      ],
      max_tokens: req.maxTokens ?? 1000, // Default to 1000 if unspecified
      temperature: req.temperature ?? 0.7, // Default to 0.7 if unspecified
    };

    // Log the request details (redact sensitive info)
    console.log('[AnthropicAdapter] Sending request:', {
      url: 'https://api.anthropic.com/v1/messages',
      body: {
        ...body,
        messages: body.messages.map(msg => ({
          ...msg,
          content: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content,
        })),
      },
      headers: { 'x-api-key': '[REDACTED]', 'anthropic-version': this.apiVersion },
    });

    try {
      // Make the API request
      const resp = await requestUrl({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey.trim(),
          'Content-Type': 'application/json',
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify(body),
      });

      // Handle HTTP errors
      if (resp.status >= 400) {
        let errorMessage = `Anthropic error ${resp.status}`;
        try {
          const errorBody = resp.json?.error?.message || resp.text || 'No additional details';
          console.error('[AnthropicAdapter] Error response body:', errorBody);
          errorMessage += `: ${errorBody}`;
          if (resp.status === 401) {
            errorMessage += '. Invalid API key.';
          } else if (resp.status === 400) {
            errorMessage += '. Check request parameters or model validity.';
          }
        } catch {
          errorMessage += ': Failed to parse error details';
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      const data = resp.json as any;
      if (!data.content || !Array.isArray(data.content) || !data.content[0]?.text) {
        console.error('[AnthropicAdapter] Unexpected response format:', data);
        throw new Error('Unexpected Anthropic API response format');
      }

      // Return the generated text and token usage
      const output = data.content[0].text.trim();
      const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      console.log('[AnthropicAdapter] Response received:', {
        output: output.length > 50 ? output.slice(0, 50) + '...' : output,
        tokensUsed,
      });

      return {
        output,
        tokensUsed,
      };
    } catch (error) {
      console.error('[AnthropicAdapter] Generation error:', error);
      throw error; // Re-throw to be handled by TextGateway or AiConsoleModal
    }
  }
}