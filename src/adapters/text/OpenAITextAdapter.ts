import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { OpenAIBaseAdapter } from '../base/OpenAIBaseAdapter';

export class OpenAITextAdapter extends OpenAIBaseAdapter implements LLMAdapter {
    private defaultModel: string;
    private fallbackModel = 'gpt-3.5-turbo';

    constructor(apiKey: string, defaultModel: string) {
        super(apiKey);
        this.defaultModel = defaultModel;
        console.log('[OpenAITextAdapter] Initialized with default model:', defaultModel);
    }

    async generate(req: LLMRequest): Promise<LLMResponse> {
        const model = await this.validateModelInternal(req.model, this.defaultModel, this.fallbackModel);

        const body = {
            model,
            messages: [
                ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
                { role: 'user', content: req.prompt },
            ],
            temperature: req.temperature ?? 0.7,
            max_tokens: req.maxTokens ?? 1000,
        };

        console.log('[OpenAITextAdapter] Sending request:', {
            endpoint: 'chat/completions',
            body: {
                ...body,
                messages: body.messages.map(msg => ({
                    ...msg,
                    content: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content,
                })),
            },
        });

        try {
            const data = await this.makeRequest('chat/completions', body, 'POST');

            if (!data.choices || !Array.isArray(data.choices) || !data.choices[0]?.message?.content) {
                console.error('[OpenAITextAdapter] Unexpected response format:', data);
                throw new Error('Unexpected OpenAI API response format');
            }

            const output = data.choices[0].message.content.trim();
            const tokensUsed = data.usage?.total_tokens || 0;

            console.log('[OpenAITextAdapter] Response received:', {
                output: output.length > 50 ? output.slice(0, 50) + '...' : output,
                tokensUsed,
                model,
            });

            return {
                output,
                tokensUsed,
            };
        } catch (error) {
            console.error('[OpenAITextAdapter] Generation error:', error);
            throw error;
        }
    }
}