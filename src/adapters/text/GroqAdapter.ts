import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { fetchGroqModels } from '../../settings/providers/groq';

/**
 * GroqAdapter implements the LLMAdapter interface for Groq's API.
 * It supports text generation using the /openai/v1/chat/completions endpoint
 * and ensures compatibility with any valid Groq model by validating against available models.
 */
export class GroqAdapter implements LLMAdapter {
  providerKey = 'groq';
  private fallbackModel = 'llama3-8b-8192'; // Safe default model from curl response

  constructor(
    private apiKey: string,
    private defaultModel: string
  ) {
    console.log('[GroqAdapter] Initialized with default model:', defaultModel);
  }

  /**
   * Validates the provided model by checking against available Groq models.
   * Returns the provided model if valid, else falls back to defaultModel or a known model.
   * @param model - The model to validate.
   * @returns A valid model ID.
   */
  private async validateModel(model?: string): Promise<string> {
    console.log('[GroqAdapter] Validating model:', model || 'undefined');

    // If no model is provided, use the default
    const candidateModel = model || this.defaultModel;

    try {
      const availableModels = await fetchGroqModels(this.apiKey);
      console.log('[GroqAdapter] Available models:', availableModels);

      // Check if the candidate model is in the available models
      if (availableModels.includes(candidateModel)) {
        console.log('[GroqAdapter] Model validated:', candidateModel);
        return candidateModel;
      }

      // If the candidate model is invalid, check if defaultModel is valid
      if (availableModels.includes(this.defaultModel)) {
        console.warn(
          '[GroqAdapter] Invalid model provided:',
          candidateModel,
          'Falling back to default:',
          this.defaultModel
        );
        return this.defaultModel;
      }

      // If both provided and default models are invalid, fall back to a known model
      if (availableModels.includes(this.fallbackModel)) {
        console.warn(
          '[GroqAdapter] Both provided model',
          candidateModel,
          'and default model',
          this.defaultModel,
          'are invalid. Falling back to:',
          this.fallbackModel
        );
        return this.fallbackModel;
      }

      // If no valid models are found, throw an error
      console.error('[GroqAdapter] No valid models available:', availableModels);
      throw new Error('No valid Groq models available. Check API key or API status.');
    } catch (error) {
      console.error('[GroqAdapter] Error fetching available models:', error);
      // If model fetch fails, fall back to defaultModel or fallbackModel
      const fallback = this.defaultModel || this.fallbackModel;
      console.warn('[GroqAdapter] Model fetch failed, using fallback model:', fallback);
      return fallback;
    }
  }

  /**
   * Generates text using Groq's /openai/v1/chat/completions endpoint.
   * Validates the model and constructs a proper request body.
   * @param req - The LLM request containing prompt, model, and other parameters.
   * @returns The generated text and token usage.
   */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    // Validate the model
    const model = await this.validateModel(req.model);

    // Construct the request body to match curl example
    const body = {
      model,
      messages: [
        ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
        { role: 'user', content: req.prompt },
      ],
      temperature: req.temperature ?? 0.7, // Default to 0.7
      max_tokens: req.maxTokens ?? 1000, // Default to 1000
    };

    // Log the request details (redact sensitive info)
    console.log('[GroqAdapter] Sending request:', {
      url: 'https://api.groq.com/openai/v1/chat/completions',
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
      // Make the API request
      const resp = await requestUrl({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Handle HTTP errors
      if (resp.status >= 400) {
        let errorMessage = `Groq error ${resp.status}`;
        try {
          const errorBody = resp.json?.error?.message || resp.text || 'No additional details';
          console.error('[GroqAdapter] Error response body:', errorBody);
          errorMessage += `: ${errorBody}`;
          if (resp.status === 401) {
            errorMessage += '. Invalid API key. Please verify your Groq API key in settings.';
          } else if (resp.status === 400) {
            errorMessage += '. Check request parameters or model validity.';
          } else if (resp.status === 403) {
            errorMessage += '. Check your API key, permissions, or account status at console.groq.com.';
          } else if (resp.status === 429) {
            errorMessage += '. Rate limit exceeded. Try again later or check your Groq account.';
          }
        } catch {
          errorMessage += ': Failed to parse error details';
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      const data = resp.json as any;
      if (!data.choices || !Array.isArray(data.choices) || !data.choices[0]?.message?.content) {
        console.error('[GroqAdapter] Unexpected response format:', data);
        throw new Error('Unexpected Groq API response format');
      }

      // Return the generated text and token usage
      const output = data.choices[0].message.content.trim();
      const tokensUsed = data.usage?.total_tokens || 0;
      console.log('[GroqAdapter] Response received:', {
        output: output.length > 50 ? output.slice(0, 50) + '...' : output,
        tokensUsed,
        model: data.model, // Log the actual model used
      });

      return {
        output,
        tokensUsed,
      };
    } catch (error) {
      console.error('[GroqAdapter] Generation error:', error);
      throw error; // Re-throw to be handled by AiConsoleModal
    }
  }
}