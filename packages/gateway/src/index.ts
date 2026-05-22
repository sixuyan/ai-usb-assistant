// @aiusb/gateway — Gateway 引擎入口
// 启动 HTTP REST + WebSocket 双协议服务

import { createServer } from './server.js';
import { initDatabase } from './db/database.js';
import { PipelineScheduler } from './pipeline/scheduler.js';
import { EventBus } from './events/event-bus.js';
import { KnowledgeStore } from './knowledge/store.js';
import { ContentFilter } from './security/content-filter.js';
import { CronManager } from './cron/manager.js';
import { capabilityRegistry } from './capability/registry.js';
import { BUILTIN_CAPABILITIES } from './capability/builtins.js';
import { ttsCapability } from './voice/tts.js';
import { sandboxCapability } from './sandbox/runner.js';
import { mcpClient } from './mcp/client.js';

const PORT = parseInt(process.env.GATEWAY_PORT || '19800', 10);

async function main() {
  console.log('[Gateway] Starting up...');

  // 初始化数据库
  const db = await initDatabase(':memory:'); // Phase 1 用内存数据库
  console.log('[Gateway] Database initialized');

  // 初始化事件总线
  const eventBus = new EventBus();
  console.log('[Gateway] Event bus ready');

  // 初始化消息流水线
  const pipeline = new PipelineScheduler(eventBus, db);
  console.log('[Gateway] Message pipeline ready');

  // 初始化知识库
  const knowledgeStore = new KnowledgeStore(db);
  console.log('[Gateway] Knowledge store ready');

  // 初始化内容过滤器
  const contentFilter = new ContentFilter();
  console.log('[Gateway] Content filter ready');

  // 注册内置能力
  for (const cap of [...BUILTIN_CAPABILITIES, ttsCapability, sandboxCapability]) {
    capabilityRegistry.register(cap);
  }
  await capabilityRegistry.initAll();
  console.log(`[Gateway] ${capabilityRegistry.getAll().length} capabilities loaded`);

  // 初始化 MCP 客户端（Phase 2 框架就绪，需要时连接外部服务器）
  console.log('[Gateway] MCP client ready');
  // mcpClient.connect({ name: 'example', transport: 'http', url: 'http://...' });

  // 初始化定时任务管理器
  const cronManager = new CronManager();
  console.log('[Gateway] Cron manager ready');

  // 启动 HTTP + WebSocket 服务
  const server = await createServer({ port: PORT, db, eventBus, pipeline, knowledgeStore, contentFilter, cronManager });
  console.log(`[Gateway] Server listening on http://127.0.0.1:${PORT}`);

  // 优雅退出
  const shutdown = async () => {
    console.log('[Gateway] Shutting down...');
    await server.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Gateway] Fatal error:', err);
  process.exit(1);
});
