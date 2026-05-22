// @aiusb/gateway — API 路由注册

import type { FastifyInstance } from 'fastify';
import type { ServerDeps } from '../server.js';
import { configRoutes } from './config.js';
import { chatRoutes } from './chat.js';
import { platformRoutes } from './platform.js';
import { messageRoutes } from './message.js';
import { knowledgeRoutes } from './knowledge.js';
import { toolRoutes } from './tools.js';
import { securityRoutes } from './security.js';
import { capabilityRoutes } from './capability.js';
import { cronRoutes } from './cron.js';
import { voiceRoutes } from './voice.js';

export function registerApiRoutes(app: FastifyInstance, deps: ServerDeps) {
  // 配置管理
  app.register(configRoutes, { prefix: '/api/config' });

  // 对话接口
  app.register(chatRoutes, { prefix: '/api/chat' });

  // 平台管理
  app.register(platformRoutes, { prefix: '/api/platform' });

  // 消息发送（通过流水线处理）
  app.register(async (fastify) => messageRoutes(fastify, deps), { prefix: '/api/message' });

  // 知识库
  app.register(async (fastify) => knowledgeRoutes(fastify, deps.knowledgeStore), { prefix: '/api/knowledge' });

  // 工具能力
  app.register(async (fastify) => toolRoutes(fastify), { prefix: '/api/tools' });

  // 内容安全
  app.register(async (fastify) => securityRoutes(fastify, deps.contentFilter), { prefix: '/api/security' });

  // 能力市场
  app.register(capabilityRoutes, { prefix: '/api/capability' });

  // 定时任务
  app.register(async (fastify) => cronRoutes(fastify, deps.cronManager), { prefix: '/api/cron' });

  // 语音 & Ollama
  app.register(voiceRoutes, { prefix: '/api/voice' });

  // 测试 LLM 连接
  app.post('/api/llm/test', async (request, reply) => {
    const { baseUrl, apiKey, model } = request.body as {
      baseUrl: string;
      apiKey: string;
      model: string;
    };

    try {
      const { createProvider } = await import('../llm/provider.js');
      const provider = createProvider({ baseUrl, apiKey, model });
      const response = await provider.chat([{ role: 'user', content: 'hi' }], undefined, { maxTokens: 1 });
      return { status: 'ok', data: { model, provider: 'online' } };
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 401) {
        return { status: 'error', message: '密钥错误，请检查是否复制完整' };
      }
      if (error.status === 404) {
        return { status: 'error', message: 'API 地址不对，请检查是否多写了 /chat/completions' };
      }
      return { status: 'error', message: `连接失败：${error.message ?? '未知错误'}` };
    }
  });

  // LLM 配置读写
  app.get('/api/llm/config', async () => {
    const config = deps.pipeline.getLLMConfig();
    // 返回脱敏后的配置（隐藏密钥）
    return {
      status: 'ok',
      data: {
        baseUrl: config.baseUrl,
        model: config.model,
        hasKey: config.apiKey.length > 0,
      },
    };
  });

  app.put('/api/llm/config', async (request) => {
    const { baseUrl, apiKey, model } = request.body as {
      baseUrl: string;
      apiKey: string;
      model: string;
    };
    deps.pipeline.updateLLMConfig({ baseUrl, apiKey, model });
    return { status: 'ok' };
  });
}
