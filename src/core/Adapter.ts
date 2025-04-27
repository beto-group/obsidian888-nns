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
  size?: string;
  n?: number;
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
  response_format?: 'url' | 'b64_json';
  user?: string;
  // gpt-image-1 specific fields
  output_format?: 'png' | 'jpeg' | 'webp';
  background?: string;
  moderation?: boolean;
  output_compression?: 'none' | 'low' | 'medium' | 'high';
}

export interface ImageResponse {
  imageUrls: string[];
}

export interface LLMAdapter {
  generate(req: LLMRequest): Promise<LLMResponse>;
}

export interface ImageAdapter {
  generate(request: ImageRequest): Promise<ImageResponse>;
}