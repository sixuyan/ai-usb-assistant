// @aiusb/gateway — 定时任务 API

import type { FastifyInstance } from 'fastify';
import type { CronManager } from '../cron/manager.js';

export function cronRoutes(app: FastifyInstance, manager: CronManager) {
  app.get('/jobs', async () => {
    return { status: 'ok', data: manager.list() };
  });

  app.post('/jobs', async (request, reply) => {
    const { name, cronExpression, action, target, enabled } = request.body as {
      name: string; cronExpression: string; action: 'send_message' | 'run_prompt';
      target: Record<string, unknown>; enabled?: boolean;
    };
    if (!name || !cronExpression) {
      return reply.status(400).send({ status: 'error', message: 'name 和 cronExpression 必填' });
    }
    const job = manager.create({
      name, cronExpression, action: action ?? 'send_message',
      target: target ?? {}, enabled: enabled ?? true,
    });
    return { status: 'ok', data: job };
  });

  app.patch('/jobs/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };
    manager.toggle(id, enabled);
    return { status: 'ok' };
  });

  app.delete('/jobs/:id', async (request) => {
    const { id } = request.params as { id: string };
    manager.delete(id);
    return { status: 'ok' };
  });

  app.post('/jobs/:id/trigger', async (request) => {
    const { id } = request.params as { id: string };
    manager.trigger(id);
    return { status: 'ok' };
  });
}
