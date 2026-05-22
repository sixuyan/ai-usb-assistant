// @aiusb/gateway — 消息 API（发送消息经过流水线处理）

import type { FastifyInstance } from 'fastify';
import type { ServerDeps } from '../server.js';
import { randomUUID } from 'node:crypto';

export async function messageRoutes(app: FastifyInstance, deps: ServerDeps) {
  // 模拟消息发送（用于 WebChat 测试）
  app.post('/send', async (request) => {
    const { text, platform, sessionId } = request.body as {
      text: string;
      platform?: string;
      sessionId?: string;
    };

    const inbound = {
      id: randomUUID(),
      platform: (platform ?? 'webchat') as 'webchat',
      chatType: 'private' as const,
      peerId: sessionId ?? 'default',
      senderId: 'user',
      senderName: '用户',
      content: [{ type: 'text' as const, text }],
      timestamp: Date.now(),
      isMention: true,
      raw: {},
    };

    const ctx = await deps.pipeline.process(inbound);
    const replyText = ctx.outbound?.content
      .filter((s) => s.type === 'text')
      .map((s) => s.text ?? '')
      .join('\n') ?? '';

    return {
      status: 'ok',
      data: {
        reply: replyText,
        sessionId: ctx.session?.id,
        blocked: ctx.blocked,
        blockReason: ctx.blockReason,
      },
    };
  });

  // WebSocket 消息测试接口
  app.post('/test', async (request) => {
    const { text } = request.body as { text: string };
    // 通过事件总线广播，让 WebSocket 客户端也能收到
    return { status: 'ok', data: { echo: text } };
  });
}
