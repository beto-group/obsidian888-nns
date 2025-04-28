import { requestUrl } from 'obsidian';

interface StabilityAIEngine {
    id: string;
    name: string;
    description: string;
    type: string;
}

interface ModelInfo {
    id: string;
    languages: string[];
}

interface CategorizedModels {
    Media: ModelInfo[];
    Language: ModelInfo[];
    '3D': ModelInfo[];
    Audio: ModelInfo[];
}

// Fallback list of models with categories and languages, based on the provided table
const fallbackModels: CategorizedModels = {
    Media: [
        { id: 'stable-diffusion-3-5-medium', languages: ['English'] },
        { id: 'stable-diffusion-3-5-large', languages: ['English'] },
        { id: 'stable-diffusion-3-5-large-turbo', languages: ['English'] },
        { id: 'stable-diffusion-3-medium', languages: ['English'] },
        { id: 'stable-diffusion-xl-turbo', languages: ['English'] },
        { id: 'stable-diffusion-turbo', languages: ['English'] },
        { id: 'stable-video-diffusion-14-frame', languages: ['English'] },
        { id: 'stable-video-diffusion-25-frame', languages: ['English'] },
        { id: 'stable-video-diffusion-1-1', languages: ['English'] },
        { id: 'japanese-sdxl', languages: ['Japanese'] },
        { id: 'japanese-stable-clip', languages: ['Japanese'] },
        // Include V1 models seen in previous API response
        { id: 'stable-diffusion-v1-6', languages: ['English'] },
        { id: 'stable-diffusion-xl-1024-v1-0', languages: ['English'] }
    ],
    Language: [
        { id: 'stable-lm-2-12b', languages: ['English', 'Spanish', 'German', 'Italian', 'French', 'Portuguese', 'Dutch'] },
        { id: 'stable-lm-2-1-6b', languages: ['English', 'Spanish', 'German', 'Italian', 'French', 'Portuguese', 'Dutch'] },
        { id: 'stable-lm-zephyr-3b', languages: ['English'] },
        { id: 'japanese-stable-lm-2-1-6b', languages: ['Japanese'] },
        { id: 'japanese-stable-vlm', languages: ['Japanese'] },
        { id: 'stable-code-instruct-3b', languages: ['English', 'Code'] },
        { id: 'stable-code-3b', languages: ['English', 'Code'] }
    ],
    '3D': [
        { id: 'stable-point-aware-3d', languages: ['English'] },
        { id: 'stable-fast-3d', languages: ['English'] },
        { id: 'stable-zero123c', languages: ['English'] },
        { id: 'stable-video-3d', languages: ['English'] }
    ],
    Audio: [
        { id: 'stable-audio-open-1-0', languages: ['English'] }
    ]
};

// Function to map API engine types to plugin categories
function mapEngineTypeToCategory(engineType: string, engineId: string): keyof CategorizedModels {
    // Map based on engine type and ID patterns
    if (engineType === 'PICTURE' || engineType === 'VIDEO' || engineId.includes('video-diffusion') || engineId.includes('sdxl') || engineId.includes('stable-diffusion')) {
        return 'Media';
    } else if (engineType === 'AUDIO' || engineId.includes('audio')) {
        return 'Audio';
    } else if (engineType === '3D' || engineId.includes('3d')) {
        return '3D';
    } else if (engineType === 'TEXT' || engineId.includes('lm') || engineId.includes('code')) {
        return 'Language';
    }
    // Default to Media for unknown types, as most Stability AI models are image-related
    return 'Media';
}

// Helper to merge fetched models with fallback models, avoiding duplicates
function mergeModels(fetched: CategorizedModels, fallback: CategorizedModels): CategorizedModels {
    const result: CategorizedModels = { Media: [], Language: [], '3D': [], Audio: [] };
    const categories: (keyof CategorizedModels)[] = ['Media', 'Language', '3D', 'Audio'];

    for (const category of categories) {
        const fetchedIds = new Set(fetched[category].map(model => model.id));
        const merged = [...fetched[category]];

        // Add fallback models that weren't fetched
        for (const fallbackModel of fallback[category]) {
            if (!fetchedIds.has(fallbackModel.id)) {
                merged.push(fallbackModel);
            }
        }

        // Sort models by ID for consistency
        result[category] = merged.sort((a, b) => a.id.localeCompare(b.id));
    }

    return result;
}

export async function fetchStabilityAIModels(apiKey: string): Promise<string[]> {
    const categorizedModels: CategorizedModels = {
        Media: [],
        Language: [],
        '3D': [],
        Audio: []
    };
    let lastError: Error | null = null;

    // Try multiple API versions to fetch models
    const apiVersions = ['v1', 'v1beta'];
    for (const apiVersion of apiVersions) {
        const url = `https://api.stability.ai/${apiVersion}/engines/list`;
        console.log('[StabilityAI] Sending request:', {
            url,
            headers: {
                Authorization: '[REDACTED]',
                'Stability-Client-ID': 'obsidian-ai-plugin',
                'Stability-Client-Version': '1.0.0'
            }
        });

        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json',
                    'Stability-Client-ID': 'obsidian-ai-plugin',
                    'Stability-Client-Version': '1.0.0'
                    // Uncomment and set the Organization header if needed
                    // 'Organization': 'org-123456'
                }
            });

            if (response.status >= 400) {
                let errorMessage = `Stability AI error (${apiVersion}): ${response.status}`;
                try {
                    const errorBody = response.json?.error?.message || response.text || 'No additional details';
                    console.log('[StabilityAI] Error response body:', errorBody);
                    errorMessage += ` - ${errorBody}`;
                    if (response.status === 401) {
                        errorMessage += '. Invalid API key.';
                    } else if (response.status === 500) {
                        errorMessage += '. Server error occurred.';
                    }
                } catch {
                    errorMessage += ' - Failed to parse error details';
                }
                throw new Error(errorMessage);
            }

            const data = response.json as StabilityAIEngine[];
            if (!Array.isArray(data)) {
                console.error('[StabilityAI] Unexpected response format:', data);
                throw new Error('Unexpected API response format');
            }

            // Categorize fetched models
            for (const engine of data) {
                const category = mapEngineTypeToCategory(engine.type, engine.id);
                // Assume English as the default language unless specified in fallback
                const modelInfo: ModelInfo = { id: engine.id, languages: ['English'] };
                // Update languages if the model is in the fallback list
                for (const cat of Object.keys(fallbackModels) as (keyof CategorizedModels)[]) {
                    const fallbackModel = fallbackModels[cat].find(m => m.id === engine.id);
                    if (fallbackModel) {
                        modelInfo.languages = fallbackModel.languages;
                        break;
                    }
                }
                categorizedModels[category].push(modelInfo);
            }

            console.log(`[StabilityAI] Fetched models from ${apiVersion}:`, categorizedModels);
        } catch (err) {
            console.error(`[StabilityAI] Error for API version ${apiVersion}:`, err);
            lastError = err;
            continue;
        }
    }

    // Merge with fallback models to ensure all models from the table are included
    const finalModels = mergeModels(categorizedModels, fallbackModels);

    // Log the final categorized models
    console.log('[StabilityAI] Final categorized model list:', finalModels);

    // For compatibility with the current plugin, return a flat list of all model IDs
    // The settings redesign can use the categorized structure directly
    const flatModelList = [
        ...finalModels.Media,
        ...finalModels.Language,
        ...finalModels['3D'],
        ...finalModels.Audio
    ].map(model => model.id).sort();

    if (flatModelList.length === 0) {
        throw lastError || new Error('Failed to fetch models with all API versions and no fallback available');
    }

    return flatModelList;
}

// Export the categorized models for use in the settings redesign
export function getCategorizedStabilityAIModels(): CategorizedModels {
    // This assumes fetchStabilityAIModels has been called and cached the results
    // For now, return the fallback models; in a real implementation, you'd cache the fetched results
    return fallbackModels;
}