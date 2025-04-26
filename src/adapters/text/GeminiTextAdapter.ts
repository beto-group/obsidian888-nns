import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { GeminiBaseAdapter } from '../base/GeminiBaseAdapter';

export class GeminiTextAdapter extends GeminiBaseAdapter implements LLMAdapter {
    private defaultModel: string;
    private fallbackModel = 'gemini-1.5-pro-latest';

    constructor(apiKey: string, defaultModel: string) {
        super(apiKey);
        this.defaultModel = defaultModel;
        console.log('[GeminiTextAdapter] Initialized with default model:', defaultModel);
    }

    async generate(req: LLMRequest): Promise<LLMResponse> {
        const model = await this.validateModelInternal(req.model, this.defaultModel, this.fallbackModel);

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

        console.log('[GeminiTextAdapter] Sending request:', {
            endpoint: `models/${model}:generateContent`,
            body: {
                contents: body.contents.map(c => ({
                    ...c,
                    parts: c.parts.map(p => ({
                        text: p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text,
                    })),
                })),
                generationConfig: body.generationConfig,
            },
        });

        let lastError: Error | null = null;

        for (const apiVersion of this.apiVersions) {
            try {
                const data = await this.makeRequest(`models/${model}:generateContent`, body, 'POST', apiVersion);

                if (
                    !data.candidates ||
                    !Array.isArray(data.candidates) ||
                    !data.candidates[0]?.content?.parts?.[0]?.text
                ) {
                    console.error('[GeminiTextAdapter] Unexpected response format:', data);
                    throw new Error('Unexpected Gemini API response format');
                }

                const output = data.candidates[0].content.parts[0].text.trim();
                const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

                console.log('[GeminiTextAdapter] Response received:', {
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
                console.error('[GeminiTextAdapter] Generation error for API version', apiVersion, ':', error);
                lastError = error;
                continue;
            }
        }

        throw lastError || new Error('All API versions failed to generate content');
    }
}