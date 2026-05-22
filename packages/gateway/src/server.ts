// @aiusb/gateway — HTTP + WebSocket 双协议服务器

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { Database } from './db/database.js';
import type { EventBus } from './events/event-bus.js';
import type { PipelineScheduler } from './pipeline/scheduler.js';
import { registerApiRoutes } from './api/index.js';
import { registerWebSocket } from './ws/handler.js';

import type { KnowledgeStore } from './knowledge/store.js';
import type { ContentFilter } from './security/content-filter.js';
import type { CronManager } from './cron/manager.js';

export interface ServerDeps {
  port: number;
  db: Database;
  eventBus: EventBus;
  pipeline: PipelineScheduler;
  knowledgeStore: KnowledgeStore;
  contentFilter: ContentFilter;
  cronManager: CronManager;
}

export async function createServer(deps: ServerDeps) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // API 路由
  registerApiRoutes(app, deps);

  // WebSocket
  registerWebSocket(app, deps);

  // 健康检查
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  await app.listen({ port: deps.port, host: '127.0.0.1' });

  return app;
}
