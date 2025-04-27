// src/core/Adapter.ts
export interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  output: string;
  tokensUsed?: number;
}

export interface ImageRequest {
  prompt: string;
  model?: string;
  n?: number; // Number of images to generate
  size?: string; // e.g., '1024x1024'
  quality?: 'standard' | 'hd';
}

export interface ImageResponse {
  imageUrls: string[];
}

export interface LLMAdapter {
  generate(req: LLMRequest): Promise<LLMResponse>;
}

export interface ImageAdapter {
  generate(req: ImageRequest): Promise<ImageResponse>;
}