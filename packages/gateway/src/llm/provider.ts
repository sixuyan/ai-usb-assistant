// @aiusb/gateway — LLM Provider 抽象层

import type { ChatMessage, ToolDefinition, ToolCall, LLMConfig } from '@aiusb/shared';

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMProvider {
  /** 发送聊天请求 */
  chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse>;

  /** 流式聊天 */
  chatStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: { maxTokens?: number; temperature?: number }
  ): AsyncGenerator<string>;
}

/**
 * 创建 LLM Provider 实例
 * 所有 OpenAI-compatible 的 API 共用此实现
 */
export function createProvider(config: LLMConfig): LLMProvider {
  const { baseUrl, apiKey, model, maxTokens = 4096, temperature = 0.7 } = config;

  async function chatImpl(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? maxTokens,
      temperature: options?.temperature ?? temperature,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      throw new Error(`LLM API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices[0];
    if (!choice) throw new Error('No response from LLM');

    return {
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      finishReason: choice.finish_reason as LLMResponse['finishReason'],
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
    };
  }

  async function* chatStreamImpl(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: { maxTokens?: number; temperature?: number }
  ): AsyncGenerator<string> {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? maxTokens,
      temperature: options?.temperature ?? temperature,
      stream: true,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LLM API error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  return {
    chat: chatImpl,
    chatStream: chatStreamImpl,
  };
}
