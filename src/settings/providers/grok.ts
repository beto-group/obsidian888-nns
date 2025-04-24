import { requestUrl } from 'obsidian';

interface XAIModel {
    id: string;
    created: number;
    object: string;
    owned_by: string;
}

interface XAIAPIResponse {
    data: XAIModel[];
}

export async function fetchGrokModels(apiKey: string): Promise<string[]> {
    try {
        const url = 'https://api.x.ai/v1/models';
        console.log('[Grok] Sending request:', {
            url,
            headers: { Authorization: `Bearer ${apiKey.trim()}` }
        });

        const response = await requestUrl({
            url,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json' // Added for compatibility
            }
        });

        if (response.status >= 400) {
            let errorMessage = `xAI error: ${response.status}`;
            try {
                const errorBody = response.json?.error?.message || response.text || 'No additional details';
                console.log('[Grok] Error response body:', errorBody);
                errorMessage += ` - ${errorBody}`;
                if (response.status === 403) {
                    errorMessage += '. Check your API key, permissions, or account status at console.x.ai.';
                }
            } catch {
                errorMessage += ' - Failed to parse error details';
            }
            throw new Error(errorMessage);
        }

        const models = (response.json as XAIAPIResponse).data?.map(m => m.id).sort() ?? [];
        console.log('[Grok] Fetched models:', models);
        return models;
    } catch (err) {
        console.error('[Grok] Model fetch error:', err);
        throw err;
    }
}