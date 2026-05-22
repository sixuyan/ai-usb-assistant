// @aiusb/gateway — BM25 搜索引擎

import type { Chunk } from './chunker.js';

/** 简单的 tokenizer：中文字符 bigram + 英文单词 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];

  // 英文单词
  const words = text.match(/[a-zA-Z0-9]+/g) ?? [];
  tokens.push(...words.map((w) => w.toLowerCase()));

  // 中文字符 bigram（适配短查询）
  const chinese = text.replace(/[^一-鿿]/g, '');
  for (let i = 0; i < chinese.length - 1; i++) {
    tokens.push(chinese.slice(i, i + 2));
  }
  // 单个字符也加入（处理单字查询）
  for (const ch of chinese) {
    tokens.push(ch);
  }

  return tokens;
}

export class BM25Search {
  private chunks: Chunk[] = [];
  private docFreq = new Map<string, number>();  // DF: 包含词 t 的文档数
  private docLengths = new Map<string, number>(); // 每个文档的长度
  private avgDocLength = 0;
  private totalDocs = 0;

  // BM25 参数
  private k1 = 1.5;
  private b = 0.75;

  /** 索引一批 chunks */
  index(chunks: Chunk[]): void {
    this.chunks = chunks;
    this.totalDocs = chunks.length;
    this.docFreq.clear();
    this.docLengths.clear();

    let totalLength = 0;

    for (const chunk of chunks) {
      const tokens = tokenize(chunk.content);
      this.docLengths.set(chunk.id, tokens.length);
      totalLength += tokens.length;

      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }

    this.avgDocLength = this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
  }

  /** 搜索 */
  search(query: string, topK = 5): Array<{ chunk: Chunk; score: number }> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const results: Array<{ chunk: Chunk; score: number }> = [];

    for (const chunk of this.chunks) {
      const docTokens = tokenize(chunk.content);
      const docLen = this.docLengths.get(chunk.id) ?? 0;
      let score = 0;

      // 计算每个查询词的 TF 权重
      const termFreq = new Map<string, number>();
      for (const t of queryTokens) {
        termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
      }

      for (const [term, qtf] of termFreq) {
        const df = this.docFreq.get(term) ?? 0;
        if (df === 0) continue;

        // IDF
        const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

        // TF in document
        const tf = docTokens.filter((t) => t === term).length;

        // BM25 公式
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        score += idf * (numerator / denominator) * qtf;
      }

      if (score > 0) {
        results.push({ chunk, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

/** RRF 混合融合（用于组合 BM25 + 其他检索器的结果） */
export function reciprocalRankFusion(
  rankings: Array<Array<{ chunk: Chunk; score: number }>>,
  k = 60,
  topK = 5,
): Array<{ chunk: Chunk; score: number }> {
  const chunkScores = new Map<string, { chunk: Chunk; score: number }>();

  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const { chunk } = ranking[i];
      const rrfScore = 1 / (k + i + 1);
      const existing = chunkScores.get(chunk.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        chunkScores.set(chunk.id, { chunk, score: rrfScore });
      }
    }
  }

  return Array.from(chunkScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
