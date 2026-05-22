// @aiusb/gateway — 平台管理 API

import type { FastifyInstance } from 'fastify';

export async function platformRoutes(app: FastifyInstance) {
  // 获取已连接平台列表
  app.get('/', async () => {
    return { status: 'ok', data: [] };
  });

  // 获取平台登录二维码（Phase 1: QQ NapCat）
  app.post('/:platform/qrcode', async (request) => {
    const { platform } = request.params as { platform: string };
    return { status: 'ok', data: { platform, qrcode: 'placeholder' } };
  });
}
