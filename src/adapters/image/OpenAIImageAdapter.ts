import { requestUrl } from 'obsidian';
import type { ImageRequest, ImageResponse } from '../../core/Adapter';

export class OpenAIImageAdapter {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, model: string = 'dall-e-3') {
    if (!apiKey) {
      throw new Error('[OpenAIImageAdapter] API key is required.');
    }
    this.apiKey = apiKey.trim();
    this.defaultModel = model;
    console.log(`[OpenAIImageAdapter] Initialized with model: ${model}`);
  }

  async generate(request: ImageRequest): Promise<ImageResponse> {
    const model = request.model || this.defaultModel;

    // Supported models and their constraints
    const supportedModels = ['dall-e-3', 'dall-e-2', 'gpt-image-1'];
    const supportedSizes: Record<string, string[]> = {
      'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
      'dall-e-2': ['256x256', '512x512', '1024x1024'],
      'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536'],
    };
    const maxN: Record<string, number> = {
      'dall-e-3': 1,
      'dall-e-2': 10,
      'gpt-image-1': 10,
    };
    const supportedQualities: Record<string, ("standard" | "hd" | "low" | "medium" | "high" | "auto")[]> = {
        'dall-e-3': ['standard', 'hd'],
        'dall-e-2': [], // No quality options
        'gpt-image-1': ['low', 'medium', 'high', 'auto'],
      };      
    const supportedOutputFormats: string[] = ['png', 'jpeg', 'webp'];

    // Validate model
    if (!supportedModels.includes(model)) {
      throw new Error(`[OpenAIImageAdapter] Unsupported model: ${model}. Supported models: ${supportedModels.join(', ')}`);
    }

    // Validate and set size
    const size = request.size && supportedSizes[model]?.includes(request.size)
      ? request.size
      : supportedSizes[model][0] || '1024x1024';

    // Validate and set n
    const n = Math.min(request.n || 1, maxN[model] || 1);
    if (request.n && request.n > maxN[model]) {
      console.warn(`[OpenAIImageAdapter] Requested n=${request.n} exceeds max for ${model} (${maxN[model]}). Using n=${n}.`);
    }

    // Validate and set quality
    let quality = request.quality || (model === 'dall-e-3' ? 'standard' : 'auto');
    if (supportedQualities[model].length > 0 && !supportedQualities[model].includes(quality)) {
      console.warn(`[OpenAIImageAdapter] Quality ${quality} not supported for model ${model}. Using default: ${supportedQualities[model][0]}.`);
      quality = supportedQualities[model][0];
    }

    // Validate output_format for gpt-image-1
    let output_format = request.output_format || 'png';
    if (model === 'gpt-image-1' && !supportedOutputFormats.includes(output_format)) {
      console.warn(`[OpenAIImageAdapter] Output format ${output_format} not supported for gpt-image-1. Using 'png'.`);
      output_format = 'png';
    }

    // Build request body
    const body: any = {
      prompt: request.prompt,
      model: model,
      n: n,
      size: size,
    };

    if (model === 'gpt-image-1') {
      body.output_format = output_format;
      if (quality !== 'auto') {
        body.quality = quality; // low, medium, high
      }
      // Add optional gpt-image-1 fields if provided
      if (request.background) body.background = request.background;
      if (request.moderation !== undefined) body.moderation = request.moderation;
      if (request.output_compression) body.output_compression = request.output_compression;
    } else {
      body.response_format = request.response_format || 'b64_json';
      if (model === 'dall-e-3' && quality) {
        body.quality = quality; // standard or hd
      }
    }

    // Add user if provided
    if (request.user) body.user = request.user;

    console.log('[OpenAIImageAdapter] Sending request:', body);

    try {
      const response = await requestUrl({
        url: 'https://api.openai.com/v1/images/generations',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status >= 400) {
        let errorMessage = `OpenAI error ${response.status}`;
        try {
          const errorBody = response.json?.error || response.text || 'No additional details';
          console.error('[OpenAIImageAdapter] Detailed error response:', errorBody);
          errorMessage += `: ${errorBody.message || errorBody}`;
          if (response.status === 400 && model === 'gpt-image-1' && body.response_format) {
            errorMessage += '. gpt-image-1 does not support response_format. Use output_format (png, jpeg, webp).';
          } else if (response.status === 401) {
            errorMessage += '. Invalid API key. Verify at https://platform.openai.com/account/api-keys.';
          } else if (response.status === 400) {
            errorMessage += '. Check request parameters (e.g., size, quality, or model validity).';
          } else if (response.status === 429) {
            errorMessage += '. Rate limit exceeded. Check quota at https://platform.openai.com/account/usage.';
          } else if (response.status === 403) {
            errorMessage += '. Check API key permissions at https://platform.openai.com/account & You might need to verify your organization : https://platform.openai.com/settings/organization/general .';
          } else if (response.status >= 500) {
            errorMessage += '. Server error at OpenAI. Try again later.';
          }
        } catch (parseError) {
          errorMessage += ': Failed to parse error details';
        }
        throw new Error(errorMessage);
      }

      if (!response.json || !response.json.data) {
        throw new Error('[OpenAIImageAdapter] Invalid response format from OpenAI API');
      }

      const imageUrls = response.json.data.map((item: { url?: string; b64_json?: string }) => {
        if (item.b64_json) {
          return item.b64_json; // Return raw base64
        } else if (item.url) {
          return item.url;
        }
        throw new Error('[OpenAIImageAdapter] No valid image data in response');
      });

      return { imageUrls };
    } catch (error: any) {
      console.error('[OpenAIImageAdapter] Image generation failed:', error);
      throw new Error(`[OpenAIImageAdapter] Failed to generate image: ${error.message || 'Unknown error'}`);
    }
  }
}