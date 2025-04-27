// src/adapters/image/OpenAIImageAdapter.ts
import type { ImageAdapter, ImageRequest, ImageResponse } from '../../core/Adapter';
import { OpenAIBaseAdapter } from '../base/OpenAIBaseAdapter';

export class OpenAIImageAdapter extends OpenAIBaseAdapter implements ImageAdapter {
    private defaultModel: string;
    private fallbackModel = 'dall-e-3';

    constructor(apiKey: string, defaultModel: string = 'dall-e-3') {
        super(apiKey);
        this.defaultModel = defaultModel;
        console.log('[OpenAIImageAdapter] Initialized with default model:', defaultModel);
    }

    async generate(req: ImageRequest): Promise<ImageResponse> {
        const model = await this.validateModelInternal(req.model, this.defaultModel, this.fallbackModel);

        const body = {
            model,
            prompt: req.prompt,
            n: req.n ?? 1,
            size: req.size ?? '1024x1024',
            quality: req.quality ?? 'standard',
            response_format: 'url',
        };

        console.log('[OpenAIImageAdapter] Sending request:', {
            endpoint: 'images/generations',
            body: {
                ...body,
                prompt: body.prompt.length > 50 ? body.prompt.slice(0, 50) + '...' : body.prompt,
            },
        });

        try {
            const data = await this.makeRequest('images/generations', body, 'POST');

            if (!data.data || !Array.isArray(data.data) || !data.data[0]?.url) {
                console.error('[OpenAIImageAdapter] Unexpected response format:', data);
                throw new Error('Unexpected OpenAI API response format');
            }

            const imageUrls = data.data.map((item: any) => item.url);
            console.log('[OpenAIImageAdapter] Response received:', {
                imageUrls: imageUrls.length,
                model,
            });

            return {
                imageUrls,
            };
        } catch (error) {
            console.error('[OpenAIImageAdapter] Generation error:', error);
            throw error;
        }
    }
}