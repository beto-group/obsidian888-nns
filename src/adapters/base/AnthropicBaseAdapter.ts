import { requestUrl } from 'obsidian';
import type { LLMRequest, LLMResponse } from '../../core/Adapter';

export abstract class AnthropicBaseAdapter {
    protected apiKey: string;
    protected apiVersion = '2023-06-01';
    public providerKey = 'anthropic';

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error(`[${this.constructor.name}] API key is required.`);
        }
        this.apiKey = apiKey.trim();
        console.log(`[${this.constructor.name}] Initialized for provider: ${this.providerKey}`);
        console.log(`[${this.constructor.name}] API key provided: [REDACTED]`);
    }

    protected async makeRequest(endpoint: string, body: any, method: 'POST' | 'GET' = 'POST'): Promise<any> {
        const url = `https://api.anthropic.com/v1/${endpoint}`;
        console.log(`[${this.constructor.name}] Sending ${method} request to ${url}`);

        try {
            const response = await requestUrl({
                url,
                method,
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': this.apiVersion,
                },
                body: method === 'POST' ? JSON.stringify(body) : undefined,
            });

            if (response.status >= 400) {
                let errorMessage = `${this.providerKey} error ${response.status}`;
                try {
                    const errorBody = response.json?.error?.message || response.text || 'No additional details';
                    console.error(`[${this.constructor.name}] Error response body:`, errorBody);
                    errorMessage += `: ${errorBody}`;
                    if (response.status === 401) {
                        errorMessage += '. Invalid API key.';
                    } else if (response.status === 400) {
                        errorMessage += '. Check request parameters or model validity.';
                    }
                } catch (parseError) {
                    errorMessage += ': Failed to parse error details';
                }
                throw new Error(errorMessage);
            }
            return response.json;
        } catch (error) {
            console.error(`[${this.constructor.name}] API request failed:`, error);
            throw error;
        }
    }

    protected async validateModelInternal(
        model: string | undefined,
        defaultModel: string,
        fallbackModel: string
    ): Promise<string> {
        console.log(`[${this.constructor.name}] Validating model: ${model || 'undefined'} (default: ${defaultModel}, fallback: ${fallbackModel})`);
        const candidateModel = model || defaultModel;
        try {
            const availableModels = await AnthropicBaseAdapter.fetchModels(this.apiKey);
            console.log(`[${this.constructor.name}] Available models:`, availableModels);
            if (availableModels.includes(candidateModel)) {
                console.log(`[${this.constructor.name}] Model validated:`, candidateModel);
                return candidateModel;
            }
            if (availableModels.includes(defaultModel)) {
                console.warn(`[${this.constructor.name}] Invalid model '${candidateModel}', falling back to default '${defaultModel}'`);
                return defaultModel;
            }
            if (availableModels.includes(fallbackModel)) {
                console.warn(`[${this.constructor.name}] Invalid models '${candidateModel}' and '${defaultModel}', falling back to known '${fallbackModel}'`);
                return fallbackModel;
            }
            console.error(`[${this.constructor.name}] No valid models available from list:`, availableModels);
            throw new Error(`No valid ${this.providerKey} models available.`);
        } catch (error) {
            console.error(`[${this.constructor.name}] Error fetching/validating models:`, error);
            const finalFallback = defaultModel || fallbackModel;
            console.warn(`[${this.constructor.name}] Using fallback model due to error:`, finalFallback);
            return finalFallback;
        }
    }

    public static async fetchModels(apiKey: string): Promise<string[]> {
        const models: string[] = [];
        let hasMore = true;
        let afterId: string | null = null;
        const limit = 100;
        const apiVersion = '2023-06-01';

        try {
            if (!apiKey) {
                throw new Error(`[AnthropicBaseAdapter] API key is required for fetching models.`);
            }

            while (hasMore) {
                const url = new URL('https://api.anthropic.com/v1/models');
                url.searchParams.append('limit', limit.toString());
                if (afterId) {
                    url.searchParams.append('after_id', afterId);
                }

                console.log(`[AnthropicBaseAdapter] Sending model fetch request:`, {
                    url: url.toString(),
                    headers: { 'x-api-key': '[REDACTED]', 'anthropic-version': apiVersion }
                });

                const response = await requestUrl({
                    url: url.toString(),
                    method: 'GET',
                    headers: {
                        'x-api-key': apiKey.trim(),
                        'anthropic-version': apiVersion
                    }
                });

                if (response.status >= 400) {
                    let errorMessage = `anthropic error: ${response.status}`;
                    try {
                        const errorBody = response.json?.error?.message || response.text || 'No additional details';
                        console.log(`[AnthropicBaseAdapter] Error response body:`, errorBody);
                        errorMessage += ` - ${errorBody}`;
                        if (response.status === 401) {
                            errorMessage += '. Invalid API key.';
                        }
                    } catch {
                        errorMessage += ' - Failed to parse error details';
                    }
                    throw new Error(errorMessage);
                }

                const data = response.json as { data: { id: string }[], has_more: boolean, last_id: string | null };
                
                if (!data.data || !Array.isArray(data.data)) {
                    console.error(`[AnthropicBaseAdapter] Unexpected response format:`, data);
                    throw new Error('Unexpected API response format');
                }
                
                const modelIds = data.data.map(m => m.id);
                models.push(...modelIds);
                
                hasMore = data.has_more;
                afterId = data.last_id;

                console.log(`[AnthropicBaseAdapter] Fetched models:`, modelIds, 'Has more:', hasMore);
                
                if (!hasMore || !afterId) break;
            }

            return models;
        } catch (error) {
            console.error(`[AnthropicBaseAdapter] Model fetch error:`, error);
            throw error;
        }
    }
}