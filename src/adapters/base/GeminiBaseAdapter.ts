import { requestUrl } from 'obsidian';

export abstract class GeminiBaseAdapter {
    protected apiKey: string;
    protected apiVersions = ['v1', 'v1beta'];
    public providerKey = 'gemini';

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error(`[${this.constructor.name}] API key is required.`);
        }
        this.apiKey = apiKey.trim();
        console.log(`[${this.constructor.name}] Initialized for provider: ${this.providerKey}`);
        console.log(`[${this.constructor.name}] API key provided: [REDACTED]`);
    }

    protected async makeRequest(endpoint: string, body: any, method: 'POST' | 'GET' = 'POST', apiVersion: string = 'v1'): Promise<any> {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/${endpoint}?key=${this.apiKey}`;
        console.log(`[${this.constructor.name}] Sending ${method} request to ${url}`);

        try {
            const response = await requestUrl({
                url,
                method,
                headers: {
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
                        errorMessage += '. Invalid API key. Verify your Gemini API key in settings at https://aistudio.google.com/app/apikey.';
                    } else if (response.status === 404) {
                        errorMessage += `. Endpoint incorrect for API version ${apiVersion} (tried ${url}). Check available models or region restrictions at https://ai.google.dev/docs.`;
                    } else if (response.status === 400) {
                        errorMessage += '. Invalid request parameters. Check prompt or model configuration.';
                    } else if (response.status === 429) {
                        errorMessage += '. Rate limit exceeded. Try again later or check your Gemini API quota at https://aistudio.google.com/app/apikey.';
                    } else if (response.status === 403) {
                        errorMessage += '. Check your API key permissions or account status at https://aistudio.google.com/app/apikey.';
                    } else if (response.status >= 500) {
                        errorMessage += '. Server error at Google. Try again later or contact Google AI support.';
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
            const availableModels = await GeminiBaseAdapter.fetchModels(this.apiKey);
            console.log(`[${this.constructor.name}] Available models:`, availableModels);

            const normalizedModels = availableModels.map(m => m.replace(/^models\//, ''));
            if (normalizedModels.includes(candidateModel)) {
                console.log(`[${this.constructor.name}] Model validated:`, candidateModel);
                return candidateModel;
            }
            if (normalizedModels.includes(defaultModel)) {
                console.warn(`[${this.constructor.name}] Invalid model '${candidateModel}', falling back to default '${defaultModel}'`);
                return defaultModel;
            }
            if (normalizedModels.includes(fallbackModel)) {
                console.warn(`[${this.constructor.name}] Invalid models '${candidateModel}' and '${defaultModel}', falling back to known '${fallbackModel}'`);
                return fallbackModel;
            }
            console.error(`[${this.constructor.name}] No valid models available from list:`, normalizedModels);
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
                throw new Error(`[GeminiBaseAdapter] API key is required for fetching models.`);
            }
            const apiVersions = ['v1', 'v1beta'];
            let lastError: Error | null = null;

            for (const apiVersion of apiVersions) {
                const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey.trim()}`;
                console.log(`[GeminiBaseAdapter] Fetching models with URL:`, url);

                try {
                    const resp = await requestUrl({
                        url,
                        method: 'GET',
                    });

                    if (resp.status !== 200) {
                        throw new Error(`Failed to fetch Gemini models: ${resp.status} - ${resp.text || 'No details'}`);
                    }

                    const data = resp.json as { models: { name: string }[] };
                    const models = data.models
                        .map(m => m.name.replace(/^models\//, ''))
                        .filter(m => m.startsWith('gemini')); // Only include Gemini models
                    console.log(`[GeminiBaseAdapter] Fetched models:`, models);
                    return models;
                } catch (error) {
                    console.error(`[GeminiBaseAdapter] Error for API version ${apiVersion}:`, error);
                    lastError = error;
                    continue;
                }
            }

            throw lastError || new Error('Failed to fetch models with all API versions');
        } catch (error) {
            console.error(`[GeminiBaseAdapter] Model fetch error:`, error);
            return ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest']; // Fallback models
        }
    }
}