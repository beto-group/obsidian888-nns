import { requestUrl } from 'obsidian';

export async function fetchOpenRouterModels(apiKey: string): Promise<string[]> {
	try {
		const url = 'https://openrouter.ai/api/v1/models';
		const response = await requestUrl({
			url,
			method: 'GET',
			headers: { Authorization: `Bearer ${apiKey}` }
		});

		if (response.status >= 400) {
			throw new Error(`OpenRouter error: ${response.status} ${response.text}`);
		}
		return response.json.data?.map((m: any) => m.id).sort() ?? [];
	} catch (err) {
		console.error('[OpenRouter] Model fetch error:', err);
		throw err;
	}
}