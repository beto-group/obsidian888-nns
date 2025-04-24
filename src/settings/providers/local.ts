import { requestUrl } from 'obsidian';

export async function fetchLocalModels(): Promise<string[]> {
	try {
		// Check if Ollama is running
		await requestUrl({ url: 'http://localhost:11434', method: 'GET' });
		const response = await requestUrl({ url: 'http://localhost:11434/api/tags', method: 'GET' });
		return response.json.models?.map((m: any) => m.name).sort() ?? [];
	} catch (err) {
		console.error('[Local] Model fetch error:', err);
		throw new Error("Unable to connect to Ollama at http://localhost:11434");
	}
}