// @aiusb/gateway — Ollama 本地模型支持

export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

export interface OllamaStatus {
  available: boolean;
  endpoint: string;
  models: OllamaModel[];
  error?: string;
}

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';

/** 检测本地 Ollama 服务是否可用 */
export async function detectOllama(endpoint = DEFAULT_ENDPOINT): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { available: false, endpoint, models: [], error: `HTTP ${res.status}` };
    }

    const data = await res.json() as { models?: Array<{ name: string; size: number; modified_at: string }> };
    const models: OllamaModel[] = (data.models ?? []).map((m) => ({
      name: m.name,
      size: formatBytes(m.size),
      modified: m.modified_at,
    }));

    return { available: true, endpoint, models };
  } catch (err: unknown) {
    const msg = (err as Error).message ?? 'Unknown error';
    return { available: false, endpoint, models: [], error: msg };
  }
}

/** 通过 Ollama 调用本地模型 */
export async function ollamaChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  endpoint = DEFAULT_ENDPOINT,
): Promise<string> {
  const res = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature: 0.7 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama chat failed: ${res.status}`);
  const data = await res.json() as { message?: { content?: string } };
  return data.message?.content ?? '';
}

/** 获取 Ollama 安装指南 */
export function getOllamaInstallGuide(): string {
  return `
📦 安装 Ollama 本地 AI：

1️⃣ 访问 https://ollama.com 下载安装包
2️⃣ 双击安装（一路下一步）
3️⃣ 安装完成后，打开终端输入：
   ollama pull qwen2.5:7b    （推荐：通义千问 7B）
   ollama pull llama3.2      （备选：Meta Llama）

4️⃣ 等待下载完成后，在这里点击"检测"即可使用

💡 推荐模型：
  - qwen2.5:7b  — 中文优化，4GB 显存即可
  - qwen2.5:14b — 效果更好，8GB 显存
  - llama3.2    — 英文优化，通用性强
  - gemma3:4b   — Google 开源，轻量高效
`.trim();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
