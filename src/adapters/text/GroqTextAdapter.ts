import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { GroqBaseAdapter } from '../base/GroqBaseAdapter';

export class GroqTextAdapter extends GroqBaseAdapter implements LLMAdapter {
    private defaultModel: string;
    private fallbackModel = 'llama3-8b-8192';

    constructor(apiKey: string, defaultModel: string) {
        super(apiKey);
        this.defaultModel = defaultModel;
        console.log('[GroqTextAdapter] Initialized with default model:', defaultModel);
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

        console.log('[GroqTextAdapter] Sending request:', {
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
                console.error('[GroqTextAdapter] Unexpected response format:', data);
                throw new Error('Unexpected Groq API response format');
            }

            const output = data.choices[0].message.content.trim();
            const tokensUsed = data.usage?.total_tokens || 0;

            console.log('[GroqTextAdapter] Response received:', {
                output: output.length > 50 ? output.slice(0, 50) + '...' : output,
                tokensUsed,
                model,
            });

            return {
                output,
                tokensUsed,
            };
        } catch (error) {
            console.error('[GroqTextAdapter] Generation error:', error);
            throw error;
        }
    }
}