import { requestUrl } from 'obsidian';

/**
 * Interface representing the structure of a single model object
 * returned by the Gemini API's models.list method.
 */
interface GeminiModel {
  name: string; // e.g., "models/gemini-1.5-flash-001"
  baseModelId?: string; // e.g., "gemini-1.5-flash"
  version?: string; // e.g., "001"
  displayName?: string; // e.g., "Gemini 1.5 Flash"
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
}

/**
 * Interface representing the overall response structure
 * from the Gemini API's models.list method.
 */
interface GeminiListModelsResponse {
  models?: GeminiModel[];
  nextPageToken?: string; // For handling pagination if needed
}

/**
 * Fetches the list of available models from the Google Gemini API.
 *
 * @param apiKey - The API key for authenticating with the Google Generative Language API.
 * @returns A promise that resolves to an array of model names (e.g., "models/gemini-pro").
 * @throws An error if the API request fails or returns an error status.
 */
/**
 * Fetches available models from the Gemini API.
 * Ensures model names are correctly formatted for use in generateContent endpoint.
 */
export async function fetchGeminiModels(apiKey: string): Promise<string[]> {
	try {
	  // Try v1 first, then fallback to v1beta
	  const apiVersions = ['v1', 'v1beta'];
	  let lastError: Error | null = null;
  
	  for (const apiVersion of apiVersions) {
		const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`;
		console.log('[fetchGeminiModels] Fetching models with URL:', url);
  
		try {
		  const resp = await requestUrl({
			url,
			method: 'GET',
		  });
  
		  if (resp.status !== 200) {
			throw new Error(`Failed to fetch Gemini models: ${resp.status} - ${resp.text || 'No details'}`);
		  }
  
		  const data = resp.json as { models: { name: string }[] };
		  // Normalize model names by removing 'models/' prefix
		  const models = data.models
			.map(m => m.name.replace(/^models\//, ''))
			.filter(m => m.startsWith('gemini')); // Only include Gemini models
		  console.log('[fetchGeminiModels] Fetched models:', models);
		  return models;
		} catch (error) {
		  console.error('[fetchGeminiModels] Error for API version', apiVersion, ':', error);
		  lastError = error;
		  continue;
		}
	  }
  
	  throw lastError || new Error('Failed to fetch models with all API versions');
	} catch (error) {
	  console.error('[fetchGeminiModels] Error:', error);
	  return ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest']; // Fallback models
	}
  }