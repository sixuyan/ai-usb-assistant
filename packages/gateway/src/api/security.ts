// @aiusb/gateway — 内容安全 API

import type { FastifyInstance } from 'fastify';
import type { ContentFilter } from '../security/content-filter.js';

export function securityRoutes(app: FastifyInstance, filter: ContentFilter) {
  // 获取所有过滤规则
  app.get('/rules', async () => {
    return { status: 'ok', data: filter.getRules() };
  });

  // 添加自定义规则
  app.post('/rules', async (request, reply) => {
    const { category, pattern, isRegex, action } = request.body as {
      category: string;
      pattern: string;
      isRegex: boolean;
      action: string;
    };
    if (!pattern) {
      return reply.status(400).send({ status: 'error', message: 'pattern 是必填项' });
    }
    const rule = filter.addRule({
      category: category as 'custom',
      pattern,
      isRegex: isRegex ?? false,
      action: (action as 'block' | 'warn' | 'log') ?? 'block',
      enabled: true,
    });
    return { status: 'ok', data: rule };
  });

  // 切换规则启用状态
  app.patch('/rules/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };
    filter.toggleRule(id, enabled);
    return { status: 'ok' };
  });

  // 删除规则
  app.delete('/rules/:id', async (request) => {
    const { id } = request.params as { id: string };
    filter.removeRule(id);
    return { status: 'ok' };
  });

  // 检查文本
  app.post('/check', async (request) => {
    const { text } = request.body as { text: string };
    if (!text) return { status: 'ok', data: { safe: true } };
    const result = filter.check(text);
    return { status: 'ok', data: result };
  });
}
