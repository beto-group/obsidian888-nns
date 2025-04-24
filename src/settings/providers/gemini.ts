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
export async function fetchGeminiModels(apiKey: string): Promise<string[]> {
	// Construct the URL for the models.list endpoint, including the API key as a query parameter.
	// Note: The v1beta version is used as specified in the documentation.
	const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;

	try {
		console.log('[Gemini] Fetching models from:', url); // Log the request URL (excluding key in production logs ideally)

		// Make the GET request using Obsidian's requestUrl function.
		// No request body is needed for this endpoint.
		const response = await requestUrl({
			url: url,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json' // Standard header, though not strictly necessary for GET
			}
		});

		// Check if the response status indicates an error (>= 400).
		if (response.status >= 400) {
			let errorMessage = `Gemini API error: ${response.status}`;
			try {
				// Attempt to parse the error message from the response body.
				const errorBody = response.json?.error?.message || response.text || 'No additional details';
				console.error('[Gemini] Error response body:', errorBody);
				errorMessage += ` - ${errorBody}`;
				if (response.status === 400) {
					errorMessage += '. Check API key or request format.';
				} else if (response.status === 401 || response.status === 403) {
                    errorMessage += '. Check if the API key is valid and has permissions for the Generative Language API.';
                } else if (response.status === 429) {
                    errorMessage += '. Rate limit exceeded. Please try again later.';
                }
			} catch (parseError) {
				// Fallback if parsing the error response fails.
				errorMessage += ` - Failed to parse error details: ${response.text}`;
			}
			// Throw an error to be caught by the calling function (e.g., in settings tab).
			throw new Error(errorMessage);
		}

		// Parse the successful JSON response.
		const data = response.json as GeminiListModelsResponse;

		// Extract the 'name' field from each model object in the 'models' array.
		// The 'name' field contains the full model identifier (e.g., "models/gemini-pro").
		// Sort the names alphabetically for consistent display.
		// Provide an empty array as a fallback if 'models' is missing or empty.
		const modelNames = data.models?.map((m: GeminiModel) => m.name).sort() ?? [];

		console.log('[Gemini] Successfully fetched models:', modelNames);
		return modelNames;

	} catch (err) {
		// Log the error and re-throw it to ensure the calling code is aware of the failure.
		console.error('[Gemini] Model fetch operation failed:', err);
		// Add a more specific prefix to the re-thrown error if it's not already a Gemini API error.
        if (err instanceof Error && !err.message.startsWith('Gemini API error')) {
            throw new Error(`[Gemini] Network or parsing error: ${err.message}`);
        }
		throw err; // Re-throw the original error (could be the one thrown above or a network error)
	}
}
