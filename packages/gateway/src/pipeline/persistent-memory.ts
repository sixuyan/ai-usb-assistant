// @aiusb/gateway — 三级记忆系统（会话 + 用户画像 + 长期知识）
//
// Level 1 — 会话记忆：最近 N 轮对话（已实现在 MemoryManager 中）
// Level 2 — 用户记忆：每个用户的偏好、事实信息（7 天 TTL，SQLite 持久化）
// Level 3 — 长期记忆：跨会话的高价值知识（向量化存储，Phase 3 升级为向量检索）

import type { Database } from '../db/database.js';
import type { ChatMessage } from '@aiusb/shared';

export interface UserProfile {
  userId: string;
  facts: string[];          // 已知事实 ["用户叫张三", "喜欢简洁回复"]
  preferences: Record<string, string>;  // { language: "zh", style: "简洁" }
  lastActive: number;
  messageCount: number;
}

export class PersistentMemoryManager {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.initTables();
  }

  private initTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_memory (
        user_id TEXT PRIMARY KEY,
        facts TEXT NOT NULL DEFAULT '[]',
        preferences TEXT NOT NULL DEFAULT '{}',
        last_active INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS long_term_memory (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fact TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        confidence REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        last_recalled INTEGER NOT NULL
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_ltm_user ON long_term_memory(user_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_ltm_category ON long_term_memory(category)`);
  }

  // ---- Level 2: User Profile ----

  /** 获取或创建用户画像 */
  getProfile(userId: string): UserProfile {
    const rows = this.db.prepare(
      'SELECT facts, preferences, last_active, message_count FROM user_memory WHERE user_id = ?',
    ).all([userId]) as Array<[string, string, number, number]>;

    if (rows.length > 0) {
      return {
        userId,
        facts: JSON.parse(rows[0][0]),
        preferences: JSON.parse(rows[0][1]),
        lastActive: rows[0][2],
        messageCount: rows[0][3],
      };
    }

    return { userId, facts: [], preferences: {}, lastActive: 0, messageCount: 0 };
  }

  /** 更新用户画像 */
  updateProfile(userId: string, updates: Partial<Pick<UserProfile, 'facts' | 'preferences'>>): void {
    const profile = this.getProfile(userId);
    if (updates.facts) profile.facts = updates.facts;
    if (updates.preferences) profile.preferences = { ...profile.preferences, ...updates.preferences };
    profile.lastActive = Date.now();
    profile.messageCount++;

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO user_memory (user_id, facts, preferences, last_active, message_count)
       VALUES (?, ?, ?, ?, ?)`,
    );
    stmt.run([userId, JSON.stringify(profile.facts), JSON.stringify(profile.preferences), profile.lastActive, profile.messageCount]);
  }

  /** 清理超过 7 天未活跃的用户数据 */
  cleanStaleProfiles(ttlDays = 7): number {
    const cutoff = Date.now() - ttlDays * 86400_000;
    const result = this.db.prepare('DELETE FROM user_memory WHERE last_active < ?').run([cutoff]);
    return result.changes;
  }

  /** 根据对话内容提取用户事实（简单关键词提取） */
  extractFact(userMessage: string): string | null {
    // 简单规则：检测"我是/我叫/我喜欢/我讨厌/我需要"等模式
    const patterns = [
      /我是([^，。,\.]+)/,
      /我叫([^，。,\.]+)/,
      /我喜欢([^，。,\.]+)/,
      /我讨厌([^，。,\.]+)/,
      /我需要([^，。,\.]+)/,
      /我想([^，。,\.]+)/,
    ];

    for (const pattern of patterns) {
      const match = userMessage.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  // ---- Level 3: Long-term Memory ----

  /** 存储长期记忆事实 */
  storeFact(userId: string, fact: string, category = 'general', confidence = 0.5): void {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO long_term_memory (id, user_id, fact, category, confidence, created_at, last_recalled) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run([id, userId, fact, category, confidence, now, now]);
  }

  /** 召回用户的长期记忆 */
  recallFacts(userId: string, category?: string, limit = 10): Array<{ fact: string; category: string; confidence: number }> {
    let query = 'SELECT fact, category, confidence FROM long_term_memory WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY confidence DESC, last_recalled DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(params) as Array<[string, string, number]>;

    // 更新召回时间
    const now = Date.now();
    this.db.prepare('UPDATE long_term_memory SET last_recalled = ? WHERE user_id = ?').run([now, userId]);

    return rows.map((row) => ({ fact: row[0], category: row[1], confidence: row[2] }));
  }

  /** 构建用户上下文（供 LLM 使用） */
  buildUserContext(userId: string): string {
    const profile = this.getProfile(userId);
    const longTermFacts = this.recallFacts(userId, undefined, 5);

    const parts: string[] = [];

    if (profile.facts.length > 0) {
      parts.push(`关于用户: ${profile.facts.join('; ')}`);
    }

    if (longTermFacts.length > 0) {
      parts.push(`历史信息: ${longTermFacts.map((f) => f.fact).join('; ')}`);
    }

    if (Object.keys(profile.preferences).length > 0) {
      parts.push(`偏好: ${Object.entries(profile.preferences).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    return parts.join('\n');
  }
}
