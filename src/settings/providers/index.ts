import { App } from 'obsidian';
import { fetchOpenAIModels } from './openai';
import { fetchLocalModels } from './local';
import { fetchAnthropicModels } from './anthropic';
import { fetchGroqModels } from './groq';
import { fetchGeminiModels } from './gemini';
import { fetchOpenRouterModels } from './openrouter';
import { fetchGrokModels } from './grok';
import { fetchStabilityAIModels } from './stabilityai'; // Added Stability AI fetcher

export interface ProviderMetadata {
    key: string;
    defaultModel: string;
    requiresApiKey: boolean;
}

export const providerMetadata: Record<string, ProviderMetadata> = {
    openai: { key: 'openai', defaultModel: 'gpt-3.5-turbo', requiresApiKey: true },
    local: { key: 'local', defaultModel: 'llama2', requiresApiKey: false }, // Ollama
    anthropic: { key: 'anthropic', defaultModel: 'claude-3-opus-20240229', requiresApiKey: true },
    groq: { key: 'groq', defaultModel: 'mixtral-8x7b-32768', requiresApiKey: true }, // GroqCloud
    gemini: { key: 'gemini', defaultModel: 'models/gemini-pro', requiresApiKey: true }, // Google Gemini
    openrouter: { key: 'openrouter', defaultModel: 'openrouter/google/gemma-7b-it', requiresApiKey: true },
    grok: { key: 'grok', defaultModel: 'grok-1', requiresApiKey: true }, // x.ai Grok
    stabilityai: { key: 'stabilityai', defaultModel: 'stable-diffusion-xl-v1', requiresApiKey: true } // Stability AI
};

// Updated FetchFunction type to accept optional apiKey and app
type FetchFunction = (apiKey: string, app?: App) => Promise<string[]>;

export const providerFetchers: Record<string, FetchFunction> = {
    openai: fetchOpenAIModels,
    local: fetchLocalModels,
    anthropic: fetchAnthropicModels,
    groq: fetchGroqModels,
    gemini: fetchGeminiModels,
    openrouter: fetchOpenRouterModels,
    grok: fetchGrokModels,
    stabilityai: fetchStabilityAIModels // Added Stability AI fetcher
};