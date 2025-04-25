// src/adapters/text/OpenAIAdapter.ts
import { requestUrl } from 'obsidian';
import type {
  LLMAdapter,
  LLMRequest,
  LLMResponse
} from '../../core/Adapter';

export class OpenAIAdapter implements LLMAdapter {
  providerKey = 'openai';

  constructor(
    private apiKey: string,
    private defaultModel: string
  ) {}

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const model = req.model ?? this.defaultModel;
    const body = {
      model,
      messages: [
        { role: 'system', content: req.systemPrompt ?? '' },
        { role: 'user', content: req.prompt }
      ],
      temperature: req.temperature,
      max_tokens: req.maxTokens
    };

    const resp = await requestUrl({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (resp.status >= 400) {
      throw new Error(
        `OpenAI error ${resp.status}: ${resp.text}`
      );
    }

    const data = resp.json as any;
    return {
      output: data.choices[0].message.content.trim(),
      tokensUsed: data.usage?.total_tokens
    };
  }
}
