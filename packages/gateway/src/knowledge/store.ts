// @aiusb/gateway — 知识库存储（SQLite 持久化）

import type { Database } from '../db/database.js';
import type { Document, Chunk } from './chunker.js';
import { chunkDocument, extractText } from './chunker.js';
import { BM25Search } from './search.js';

export class KnowledgeStore {
  private bm25 = new BM25Search();
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.initTables();
  }

  private initTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS knowledge_docs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        uploaded_at INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id)
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_doc ON knowledge_chunks(doc_id)`);
  }

  /** 上传文档：解析 → 分块 → 存库 → 索引 */
  addDocument(filename: string, buffer: Buffer): Document {
    const text = extractText(filename, buffer);
    const doc: Document = {
      id: crypto.randomUUID(),
      title: filename.replace(/\.[^.]+$/, ''),
      source: filename,
      content: text,
      uploadedAt: Date.now(),
    };

    // 存入文档表
    const stmt = this.db.prepare(
      'INSERT INTO knowledge_docs (id, title, source, content, uploaded_at) VALUES (?, ?, ?, ?, ?)',
    );
    stmt.run([doc.id, doc.title, doc.source, doc.content, doc.uploadedAt]);

    // 分块
    const chunks = chunkDocument(doc);
    const insertChunk = this.db.prepare(
      'INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index, position, title, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );

    for (const chunk of chunks) {
      insertChunk.run([
        chunk.id, chunk.docId, chunk.content, chunk.index,
        chunk.metadata.position, chunk.metadata.title, chunk.metadata.source,
      ]);
    }

    // 重新索引
    this.reindex();

    return doc;
  }

  /** 搜索知识库 */
  search(query: string, topK = 5): Array<{ content: string; title: string; source: string; score: number }> {
    if (!query.trim()) return [];

    const results = this.bm25.search(query, topK);
    return results.map((r) => ({
      content: r.chunk.content,
      title: r.chunk.metadata.title,
      source: r.chunk.metadata.source,
      score: r.score,
    }));
  }

  /** 获取所有文档 */
  listDocuments(): Document[] {
    const rows = this.db.prepare(
      'SELECT id, title, source, content, uploaded_at FROM knowledge_docs ORDER BY uploaded_at DESC',
    ).all() as Array<[string, string, string, string, number]>;

    return rows.map((row) => ({
      id: row[0],
      title: row[1],
      source: row[2],
      content: row[3],
      uploadedAt: row[4],
    }));
  }

  /** 删除文档及其分块 */
  deleteDocument(id: string): void {
    this.db.prepare('DELETE FROM knowledge_docs WHERE id = ?').run([id]);
    this.db.prepare('DELETE FROM knowledge_chunks WHERE doc_id = ?').run([id]);
    this.reindex();
  }

  /** 重新构建 BM25 索引 */
  private reindex(): void {
    const rows = this.db.prepare(
      'SELECT id, doc_id, content, chunk_index, position, title, source FROM knowledge_chunks',
    ).all() as Array<[string, string, string, number, number, string, string]>;

    const chunks: Chunk[] = rows.map((row) => ({
      id: row[0],
      docId: row[1],
      content: row[2],
      index: row[3],
      metadata: { title: row[5], source: row[6], position: row[4] },
    }));

    this.bm25.index(chunks);
  }
}
