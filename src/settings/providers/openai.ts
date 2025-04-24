import { requestUrl } from 'obsidian';

export async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
	try {
		const url = 'https://api.openai.com/v1/models';
		const response = await requestUrl({
			url,
			method: 'GET',
			headers: { Authorization: `Bearer ${apiKey}` }
		});

		if (response.status >= 400) {
			throw new Error(`OpenAI error: ${response.status} ${response.text}`);
		}
		return response.json.data?.map((m: any) => m.id).sort() ?? [];
	} catch (err) {
		console.error('[OpenAI] Model fetch error:', err);
		throw err;
	}
}