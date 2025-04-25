// src/core/Adapter.ts
export interface LLMRequest {
    prompt: string;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }
  
  export interface LLMResponse {
    output: string;
    tokensUsed?: number;
  }
  
  export interface LLMAdapter {
    /** e.g. 'openai', 'anthropic' */
    providerKey: string;
    generate(request: LLMRequest): Promise<LLMResponse>;
  }
  