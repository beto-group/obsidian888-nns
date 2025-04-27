import { App } from 'obsidian';
import { AnthropicBaseAdapter } from '../../adapters/base/AnthropicBaseAdapter';
import { GeminiBaseAdapter } from '../../adapters/base/GeminiBaseAdapter';
import { GrokBaseAdapter } from '../../adapters/base/GrokBaseAdapter';
import { GroqBaseAdapter } from '../../adapters/base/GroqBaseAdapter';
import { OpenAIBaseAdapter } from '../../adapters/base/OpenAIBaseAdapter';
import { OpenRouterBaseAdapter } from '../../adapters/base/OpenRouterBaseAdapter';
import { StabilityAIBaseAdapter } from '../../adapters/base/StabilityAIBaseAdapter';
import { fetchLocalModels } from './local';

export interface ProviderMetadata {
    key: string;
    defaultModel: string;
    requiresApiKey: boolean;
}

export const providerMetadata: Record<string, ProviderMetadata> = {
    openai: { key: 'openai', defaultModel: 'gpt-3.5-turbo', requiresApiKey: true },
    local: { key: 'local', defaultModel: 'llama2', requiresApiKey: false },
    anthropic: { key: 'anthropic', defaultModel: 'claude-3-opus-20240229', requiresApiKey: true },
    groq: { key: 'groq', defaultModel: 'mixtral-8x7b-32768', requiresApiKey: true },
    gemini: { key: 'gemini', defaultModel: 'models/gemini-pro', requiresApiKey: true },
    openrouter: { key: 'openrouter', defaultModel: 'openrouter/google/gemma-7b-it', requiresApiKey: true },
    grok: { key: 'grok', defaultModel: 'grok-1', requiresApiKey: true },
    stabilityai: { key: 'stabilityai', defaultModel: 'stable-diffusion-xl-v1', requiresApiKey: true }
};

type FetchFunction = (apiKey: string, app?: App) => Promise<string[]>;

export const providerFetchers: Record<string, FetchFunction> = {
    openai: async (apiKey: string) => {
        return await OpenAIBaseAdapter.fetchModels(apiKey);
    },
    local: fetchLocalModels,
    anthropic: async (apiKey: string) => {
        return await AnthropicBaseAdapter.fetchModels(apiKey);
    },
    groq: async (apiKey: string) => {
        return await GroqBaseAdapter.fetchModels(apiKey);
    },
    gemini: async (apiKey: string) => {
        return await GeminiBaseAdapter.fetchModels(apiKey);
    },
    openrouter: async (apiKey: string) => {
        return await OpenRouterBaseAdapter.fetchModels(apiKey);
    },
    grok: async (apiKey: string) => {
        return await GrokBaseAdapter.fetchModels(apiKey);
    },
    stabilityai: async (apiKey: string) => {
        return await StabilityAIBaseAdapter.fetchModels(apiKey);
    }
};