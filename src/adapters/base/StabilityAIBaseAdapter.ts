import { requestUrl } from 'obsidian';

export abstract class StabilityAIBaseAdapter {
    protected apiKey: string;
    public providerKey = 'stabilityai';

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error(`[${this.constructor.name}] API key is required.`);
        }
        this.apiKey = apiKey.trim();
        console.log(`[${this.constructor.name}] Initialized for provider: ${this.providerKey}`);
        console.log(`[${this.constructor.name}] API key provided: [REDACTED]`);
    }

    protected async makeRequest(endpoint: string, body: any, method: 'POST' | 'GET' = 'POST'): Promise<any> {
        const url = `https://api.stability.ai/v1/${endpoint}`;
        console.log(`[${this.constructor.name}] Sending ${method} request to ${url}`);

        try {
            const response = await requestUrl({
                url,
                method,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
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
                        errorMessage += '. Invalid API key. Verify your StabilityAI API key at https://platform.stability.ai/account/keys.';
                    } else if (response.status === 400) {
                        errorMessage += '. Check request parameters or model validity.';
                    } else if (response.status === 429) {
                        errorMessage += '. Rate limit exceeded. Try again later or check your StabilityAI quota at https://platform.stability.ai/account/credits.';
                    } else if (response.status === 403) {
                        errorMessage += '. Check your API key permissions or account status at https://platform.stability.ai/account.';
                    } else if (response.status >= 500) {
                        errorMessage += '. Server error at StabilityAI. Try again later or contact StabilityAI support.';
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
            const availableModels = await StabilityAIBaseAdapter.fetchModels(this.apiKey);
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
        try {
            if (!apiKey) {
                throw new Error(`[StabilityAIBaseAdapter] API key is required for fetching models.`);
            }
            const url = 'https://api.stability.ai/v1/engines/list';
            console.log(`[StabilityAIBaseAdapter] Sending model fetch request:`, {
                url,
                headers: { Authorization: `Bearer ${apiKey.trim()}` }
            });

            const response = await requestUrl({
                url,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status >= 400) {
                let errorMessage = `stabilityai error: ${response.status}`;
                try {
                    const errorBody = response.json?.error?.message || response.text || 'No additional details';
                    console.log(`[StabilityAIBaseAdapter] Error response body:`, errorBody);
                    errorMessage += ` - ${errorBody}`;
                    if (response.status === 401) {
                        errorMessage += '. Invalid API key. Verify your StabilityAI API key at https://platform.stability.ai/account/keys.';
                    } else if (response.status === 403) {
                        errorMessage += '. Check your API key permissions or account status at https://platform.stability.ai/account.';
                    }
                } catch {
                    errorMessage += ' - Failed to parse error details';
                }
                throw new Error(errorMessage);
            }

            const models = (response.json as { id: string }[])
                ?.map(m => m.id)
                .filter(id => id.includes('stable-diffusion'))
                .sort() ?? [];
            console.log(`[StabilityAIBaseAdapter] Fetched models:`, models);
            return models;
        } catch (error) {
            console.error(`[StabilityAIBaseAdapter] Model fetch error:`, error);
            throw error;
        }
    }
}