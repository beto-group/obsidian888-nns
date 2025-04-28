import type { ImageRequest, ImageResponse } from '../../core/Adapter';
import { OpenAIBaseAdapter } from '../base/OpenAIBaseAdapter';

export class OpenAIImageAdapter extends OpenAIBaseAdapter {
  private defaultModel: string;

  constructor(apiKey: string, model: string = 'dall-e-3') {
    super(apiKey);
    this.defaultModel = model;
    console.log('[OpenAIImageAdapter] Initialized with model:', model);
  }

  async generate(request: ImageRequest): Promise<ImageResponse> {
    const model = request.model || this.defaultModel;

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
      'dall-e-2': [],
      'gpt-image-1': ['low', 'medium', 'high', 'auto'],
    };
    const supportedOutputFormats = ['png', 'jpeg', 'webp'];

    if (!supportedModels.includes(model)) {
      throw new Error(`[OpenAIImageAdapter] Unsupported model: ${model}`);
    }

    const size = request.size && supportedSizes[model]?.includes(request.size)
      ? request.size
      : supportedSizes[model][0];

    const n = Math.min(request.n || 1, maxN[model]);
    let quality = request.quality || (model === 'dall-e-3' ? 'standard' : 'auto');
    if (supportedQualities[model].length > 0 && !supportedQualities[model].includes(quality)) {
      quality = supportedQualities[model][0];
    }

    let output_format = request.output_format || 'png';
    if (model === 'gpt-image-1' && !supportedOutputFormats.includes(output_format)) {
      output_format = 'png';
    }

    const body: any = {
      prompt: request.prompt,
      model,
      n,
      size,
    };

    if (model === 'gpt-image-1') {
      body.output_format = output_format;
      if (quality !== 'auto') {
        body.quality = quality;
      }
      if (request.background) body.background = request.background;
      if (request.moderation !== undefined) body.moderation = request.moderation;
      if (request.output_compression) body.output_compression = request.output_compression;
    } else {
      body.response_format = request.response_format || 'b64_json';
      if (model === 'dall-e-3' && quality) {
        body.quality = quality;
      }
    }

    if (request.user) {
      body.user = request.user;
    }

    console.log('[OpenAIImageAdapter] Sending request body:', body);

    try {
      const data = await this.makeRequest('images/generations', body, 'POST');

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('[OpenAIImageAdapter] Invalid response format from OpenAI API');
      }

      const imageUrls = data.data.map((item: { url?: string; b64_json?: string }) => {
        if (item.b64_json) return item.b64_json;
        if (item.url) return item.url;
        throw new Error('[OpenAIImageAdapter] Missing image data in response');
      });

      return { imageUrls };
    } catch (error: any) {
      console.error('[OpenAIImageAdapter] Image generation failed:', error);
      throw new Error(`[OpenAIImageAdapter] Failed to generate image: ${error.message || 'Unknown error'}`);
    }
  }
}
