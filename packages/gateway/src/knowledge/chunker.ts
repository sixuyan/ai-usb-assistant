// @aiusb/gateway — 文档解析与分块

import { randomUUID } from 'crypto';

export interface Document {
  id: string;
  title: string;
  source: string;       // 原始文件名
  content: string;
  uploadedAt: number;
}

export interface Chunk {
  id: string;
  docId: string;
  content: string;
  index: number;        // 在文档中的位置
  metadata: {
    title: string;
    source: string;
    position: number;   // 字符偏移
  };
}

/**
 * 智能分块：先按段落，超长段按句子，带重叠
 */
export function chunkDocument(doc: Document, maxChunkChars = 800, overlapChars = 100): Chunk[] {
  const paragraphs = doc.content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let index = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length <= maxChunkChars) {
      chunks.push(createChunk(doc, trimmed, index++, chunks.length === 0 ? 0 : chunks[chunks.length - 1]?.metadata.position ?? 0));
    } else {
      // 超长段按句子拆分
      const sentences = splitSentences(trimmed);
      let current = '';
      for (const sent of sentences) {
        if ((current + sent).length > maxChunkChars && current.length > 0) {
          chunks.push(createChunk(doc, current.trim(), index++, chunks.length === 0 ? 0 : chunks[chunks.length - 1]?.metadata.position ?? 0));
          current = current.slice(-overlapChars) + sent;
        } else {
          current += sent;
        }
      }
      if (current.trim().length > 0) {
        chunks.push(createChunk(doc, current.trim(), index++, chunks.length === 0 ? 0 : chunks[chunks.length - 1]?.metadata.position ?? 0));
      }
    }
  }

  return chunks;
}

/** 简单分句（中英文兼容） */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？.!?\n])\s*/)
    .filter((s) => s.trim().length > 0);
}

function createChunk(doc: Document, content: string, index: number, position: number): Chunk {
  return {
    id: randomUUID(),
    docId: doc.id,
    content,
    index,
    metadata: {
      title: doc.title,
      source: doc.source,
      position,
    },
  };
}

/**
 * 提取文本（从原始 Buffer）
 * Phase 2 支持 .txt 和 .md
 */
export function extractText(filename: string, buffer: Buffer): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'txt':
    case 'md':
      return buffer.toString('utf-8');
    case 'json':
      return buffer.toString('utf-8');
    default:
      // 尝试 UTF-8 解码
      return buffer.toString('utf-8');
  }
}
