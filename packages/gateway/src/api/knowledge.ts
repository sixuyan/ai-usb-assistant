// @aiusb/gateway — 知识库 API

import type { FastifyInstance } from 'fastify';
import type { KnowledgeStore } from '../knowledge/store.js';

export async function knowledgeRoutes(app: FastifyInstance, store: KnowledgeStore) {
  // 上传文档（接受 JSON body 中的文本内容）
  app.post('/upload', async (request, reply) => {
    const { filename, content } = request.body as { filename?: string; content?: string };
    if (!content) {
      return reply.status(400).send({ status: 'error', message: '请提供文件内容' });
    }

    const name = filename ?? `doc-${Date.now()}.txt`;
    const buffer = Buffer.from(content, 'utf-8');

    try {
      const doc = store.addDocument(name, buffer);
      return {
        status: 'ok',
        data: { id: doc.id, title: doc.title, source: doc.source },
      };
    } catch (err: unknown) {
      return { status: 'error', message: `文件处理失败: ${(err as Error).message}` };
    }
  });

  // 搜索知识库
  app.get('/search', async (request) => {
    const { q, topK } = request.query as { q?: string; topK?: string };
    if (!q || !q.trim()) {
      return { status: 'ok', data: [] };
    }

    const results = store.search(q, parseInt(topK ?? '5', 10));
    return { status: 'ok', data: results };
  });

  // 列出所有文档
  app.get('/documents', async () => {
    const docs = store.listDocuments();
    return { status: 'ok', data: docs };
  });

  // 删除文档
  app.delete('/documents/:id', async (request) => {
    const { id } = request.params as { id: string };
    store.deleteDocument(id);
    return { status: 'ok' };
  });

  // 在流水线中检索（供 Agent 使用）
  app.post('/retrieve', async (request) => {
    const { query, topK } = request.body as { query: string; topK?: number };
    const results = store.search(query, topK ?? 5);
    return { status: 'ok', data: results };
  });
}
