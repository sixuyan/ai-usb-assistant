// @aiusb/gateway — 能力市场 API

import type { FastifyInstance } from 'fastify';
import { capabilityRegistry } from '../capability/registry.js';

export function capabilityRoutes(app: FastifyInstance) {
  // 获取所有已注册能力
  app.get('/list', async () => {
    return { status: 'ok', data: capabilityRegistry.getAll() };
  });

  // 获取所有可用工具
  app.get('/tools', async () => {
    return { status: 'ok', data: capabilityRegistry.getAllTools() };
  });
}
