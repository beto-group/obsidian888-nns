import type { ImageRequest, ImageResponse } from '../../core/Adapter';
import { GrokBaseAdapter } from '../base/GrokBaseAdapter';
import { requestUrl } from 'obsidian';

export class GrokImageAdapter extends GrokBaseAdapter {
  private defaultModel: string;

  constructor(apiKey: string, model: string = 'grok-2-image-1212') {
    super(apiKey);
    this.defaultModel = model;
    console.log('[GrokImageAdapter] Initialized with model:', model);
  }

  // Utility to check if a string is a valid base64 data URL
  private isDataUrl(str: string): boolean {
    return str.startsWith('data:image/') && str.includes(';base64,');
  }

  // Utility to extract base64 data from a data URL or return raw base64
  private normalizeBase64(str: string): string {
    if (this.isDataUrl(str)) {
      // Extract the base64 part after the comma
      return str.split(';base64,')[1] || str;
    }
    return str;
  }

  async generate(request: ImageRequest): Promise<ImageResponse> {
    const model = request.model || this.defaultModel;

    // Validate model dynamically using fetchImageModels
    const availableModels = await GrokBaseAdapter.fetchImageModels(this.apiKey);
    if (!availableModels.includes(model)) {
      throw new Error(`[GrokImageAdapter] Unsupported model: ${model}. Available models: ${availableModels.join(', ')}`);
    }

    // Validate number of images (max 10 per xAI API)
    const n = Math.min(request.n || 1, 10);

    // Validate prompt
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('[GrokImageAdapter] Prompt is required and cannot be empty');
    }
    if (request.prompt.length > 1000) {
      throw new Error('[GrokImageAdapter] Prompt exceeds 1000 character limit');
    }

    // Build minimal request body for xAI API
    const body = {
      prompt: request.prompt,
      model,
      n,
    };

    console.log('[GrokImageAdapter] Sending request body:', body);

    try {
      // Use /v1/images/generations endpoint (xAI API)
      const data = await this.makeRequest('images/generations', body, 'POST');

      // Log raw response for debugging
      console.log('[GrokImageAdapter] Raw API response:', JSON.stringify(data, null, 2));

      // Try parsing multiple possible response formats
      let imageItems: any[] = [];
      if (data.images && Array.isArray(data.images)) {
        imageItems = data.images;
      } else if (data.data && Array.isArray(data.data)) {
        imageItems = data.data;
      } else {
        throw new Error('[GrokImageAdapter] Invalid response format: Expected images or data array');
      }

      const imageUrls = await Promise.all(
        imageItems.map(async (item, index) => {
          // Try multiple field names for base64 data
          if (item.base64) {
            const base64 = this.normalizeBase64(item.base64);
            return `data:image/jpeg;base64,${base64}`;
          }
          if (item.b64_json) {
            const base64 = this.normalizeBase64(item.b64_json);
            return `data:image/jpeg;base64,${base64}`;
          }
          if (item.image) {
            const base64 = this.normalizeBase64(item.image);
            return `data:image/jpeg;base64,${base64}`;
          }
          if (item.data?.base64) {
            const base64 = this.normalizeBase64(item.data.base64);
            return `data:image/jpeg;base64,${base64}`;
          }
          if (item.data?.b64_json) {
            const base64 = this.normalizeBase64(item.data.b64_json);
            return `data:image/jpeg;base64,${base64}`;
          }
          if (item.data?.image) {
            const base64 = this.normalizeBase64(item.data.image);
            return `data:image/jpeg;base64,${base64}`;
          }
          // Handle URL responses by fetching base64
          if (item.url) {
            try {
              const response = await requestUrl({ url: item.url, method: 'GET' });
              if (response.status >= 400) {
                throw new Error(`Failed to fetch image from URL: ${response.status}`);
              }
              const buffer = await response.arrayBuffer;
              const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                return window.btoa(binary);
              };
              const base64 = arrayBufferToBase64(buffer);
              return `data:image/jpeg;base64,${base64}`;
            } catch (fetchError) {
              console.error('[GrokImageAdapter] Failed to fetch image from URL:', item.url, fetchError);
              throw new Error(`Failed to fetch image from URL in response item ${index}`);
            }
          }
          throw new Error(`[GrokImageAdapter] Missing base64 data or URL in response item ${index}`);
        })
      );

      // Validate the generated URLs
      imageUrls.forEach((url, index) => {
        if (!this.isDataUrl(url) && !url.startsWith('http')) {
          console.error('[GrokImageAdapter] Invalid image URL generated:', url);
          throw new Error(`Invalid image URL for item ${index}: ${url}`);
        }
      });

      return { imageUrls };
    } catch (error: any) {
      console.error('[GrokImageAdapter] Image generation failed:', error);
      console.error('[GrokImageAdapter] API error response:', error.response?.data);
      let errorMessage = error.message || 'Unknown error';
      if (error.message.includes('400')) {
        errorMessage = 'Invalid request parameters or prompt content. Ensure the prompt complies with xAI content policies and try again.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Invalid API key. Verify your xAI API key at https://console.x.ai.';
      } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Wait and try again.';
      }
      throw new Error(`[GrokImageAdapter] Failed to generate image: ${errorMessage}`);
    }
  }
}