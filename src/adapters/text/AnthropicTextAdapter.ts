// src/adapters/text/AnthropicTextAdapter.ts
import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../../core/Adapter';
import { fetchAnthropicModels } from '../../settings/providers/anthropic';
import { AnthropicBaseAdapter } from '../base/AnthropicBaseAdapter';

export class AnthropicTextAdapter extends AnthropicBaseAdapter implements LLMAdapter {
    private defaultModel: string;
    private fallbackModel = 'claude-3-5-sonnet-20241022';

    constructor(apiKey: string, defaultModel: string) {
        super(apiKey);
        this.defaultModel = defaultModel;
        console.log('[AnthropicTextAdapter] Initialized with default model:', defaultModel);
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

        console.log('[AnthropicTextAdapter] Sending request:', {
            endpoint: 'messages',
            body: {
                ...body,
                messages: body.messages.map(msg => ({
                    ...msg,
                    content: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content,
                })),
            },
        });

        try {
            const data = await this.makeRequest('messages', body, 'POST');

            if (!data.content || !Array.isArray(data.content) || !data.content[0]?.text) {
                console.error('[AnthropicTextAdapter] Unexpected response format:', data);
                throw new Error('Unexpected Anthropic API response format');
            }

            const output = data.content[0].text.trim();
            const tokensUsed = (data.usage?.output_tokens || 0) + (data.usage?.input_tokens || 0);

            console.log('[AnthropicTextAdapter] Response received:', {
                output: output.length > 50 ? output.slice(0, 50) + '...' : output,
                tokensUsed,
                model,
            });

            return {
                output,
                tokensUsed,
            };
        } catch (error) {
            console.error('[AnthropicTextAdapter] Generation error:', error);
            throw error;
        }
    }
}