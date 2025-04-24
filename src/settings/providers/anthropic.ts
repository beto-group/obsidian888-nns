import { requestUrl } from 'obsidian';

// Define response types based on Anthropic API documentation
interface AnthropicModel {
    id: string;
    created_at: string;
    display_name: string;
    type: string;
}

interface AnthropicAPIResponse {
    data: AnthropicModel[];
    first_id: string | null;
    last_id: string | null;
    has_more: boolean;
}

export async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
    const models: string[] = [];
    let hasMore = true;
    let afterId: string | null = null;
    const apiVersion = '2023-06-01'; // Set to a stable, supported version
    const limit = 100; // Increase limit to get more models in one request

    try {
        while (hasMore) {
            const url = new URL('https://api.anthropic.com/v1/models');
            url.searchParams.append('limit', limit.toString());
            if (afterId) {
                url.searchParams.append('after_id', afterId);
            }

            console.log('[Anthropic] Sending request:', {
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
                let errorMessage = `Anthropic error: ${response.status}`;
                try {
                    const errorBody = response.json?.error?.message || response.text || 'No additional details';
                    console.log('[Anthropic] Error response body:', errorBody);
                    errorMessage += ` - ${errorBody}`;
                    if (response.status === 401) {
                        errorMessage += '. Invalid API key.';
                    }
                } catch {
                    errorMessage += ' - Failed to parse error details';
                }
                throw new Error(errorMessage);
            }

            const data = response.json as AnthropicAPIResponse;
            
            if (!data.data || !Array.isArray(data.data)) {
                console.error('[Anthropic] Unexpected response format:', data);
                throw new Error('Unexpected API response format');
            }
            
            const modelIds = data.data.map(m => m.id);
            models.push(...modelIds);
            
            hasMore = data.has_more;
            afterId = data.last_id;

            console.log('[Anthropic] Fetched models:', modelIds, 'Has more:', hasMore);
            
            if (!hasMore || !afterId) break;
        }

        return models;
    } catch (error) {
        console.error('[Anthropic] Model fetch error:', error);
        throw error;
    }
}