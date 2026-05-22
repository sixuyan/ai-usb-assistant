// @aiusb/gateway — 工具 API（Web 搜索等）

import type { FastifyInstance } from 'fastify';
import { webSearch, formatSearchResults } from '../tools/web-search.js';

export async function toolRoutes(app: FastifyInstance) {
  // Web 搜索
  app.get('/web-search', async (request) => {
    const { q, n } = request.query as { q?: string; n?: string };
    if (!q || !q.trim()) {
      return { status: 'error', message: '请输入搜索关键词' };
    }

    const results = await webSearch(q, parseInt(n ?? '5', 10));
    return {
      status: 'ok',
      data: {
        results,
        formatted: formatSearchResults(results),
      },
    };
  });
}
