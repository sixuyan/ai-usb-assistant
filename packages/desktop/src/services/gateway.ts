// @aiusb/desktop — Gateway API 客户端

const BASE = 'http://127.0.0.1:19800';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Gateway error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  message?: string;
  data?: T;
}

export const gateway = {
  /** 健康检查 */
  health: () => request<{ status: string; uptime: number }>('/health'),

  /** 测试 LLM 连接 */
  testLLM: (config: { baseUrl: string; apiKey: string; model: string }) =>
    request<ApiResponse<{ model: string; provider: string }>>('/api/llm/test', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  /** 获取 LLM 配置 */
  getLLMConfig: () =>
    request<ApiResponse<{ baseUrl: string; model: string; hasKey: boolean }>>('/api/llm/config'),

  /** 更新 LLM 配置 */
  updateLLMConfig: (config: { baseUrl: string; apiKey: string; model: string }) =>
    request<ApiResponse>('/api/llm/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  /** 发送消息（经过流水线） */
  sendMessage: (text: string, platform?: string, sessionId?: string) =>
    request<ApiResponse<{ reply: string; sessionId: string; blocked: boolean }>>('/api/message/send', {
      method: 'POST',
      body: JSON.stringify({ text, platform, sessionId }),
    }),

  /** 获取平台列表 */
  getPlatforms: () => request<ApiResponse<unknown[]>>('/api/platform'),
};
