// @aiusb/gateway — WebSocket 实时通信

import type { FastifyInstance } from 'fastify';
import type { ServerDeps } from '../server.js';

export function registerWebSocket(app: FastifyInstance, deps: ServerDeps) {
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket, req) => {
      console.log('[WS] Client connected');

      // 转发事件到 WebSocket 客户端
      const onMessageProcessed = (data: { ctx: unknown }) => {
        socket.send(JSON.stringify({ type: 'message:processed', data }));
      };

      deps.eventBus.on('message:processed', onMessageProcessed);

      socket.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          // Phase 1 占位：回显
          socket.send(JSON.stringify({ type: 'echo', data: msg }));
        } catch {
          // ignore malformed messages
        }
      });

      socket.on('close', () => {
        deps.eventBus.off('message:processed', onMessageProcessed);
        console.log('[WS] Client disconnected');
      });
    });
  });
}
