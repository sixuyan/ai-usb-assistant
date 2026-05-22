// @aiusb/gateway — 对话 API

import type { FastifyInstance } from 'fastify';

export async function chatRoutes(app: FastifyInstance) {
  // 发送消息（供 WebChat 使用或 API 调用）
  app.post('/send', async (request) => {
    const { message, sessionId } = request.body as { message: string; sessionId?: string };
    // Phase 1 占位：直接回显
    return {
      status: 'ok',
      data: {
        reply: `收到你的消息: ${message}`,
        sessionId: sessionId ?? 'default',
      },
    };
  });

  // 获取会话列表
  app.get('/sessions', async () => {
    return { status: 'ok', data: [] };
  });
}
