// @aiusb/gateway — 配置相关 API

import type { FastifyInstance } from 'fastify';
import type { UserConfig } from '@aiusb/shared';

export async function configRoutes(app: FastifyInstance) {
  // 获取全量配置
  app.get('/', async () => {
    return { status: 'ok', data: {} };
  });

  // 更新配置
  app.put('/', async (request, reply) => {
    const config = request.body as Partial<UserConfig>;
    return { status: 'ok', data: config };
  });
}
