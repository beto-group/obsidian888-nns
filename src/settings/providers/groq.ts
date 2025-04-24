import { requestUrl } from 'obsidian';

export async function fetchGroqModels(apiKey: string): Promise<string[]> {
	try {
		const url = 'https://api.groq.com/openai/v1/models';
		const response = await requestUrl({
			url,
			method: 'GET',
			headers: { Authorization: `Bearer ${apiKey}` }
		});

		if (response.status >= 400) {
			throw new Error(`Groq error: ${response.status} ${response.text}`);
		}
		return response.json.data?.map((m: any) => m.id).sort() ?? [];
	} catch (err) {
		console.error('[Groq] Model fetch error:', err);
		throw err;
	}
}