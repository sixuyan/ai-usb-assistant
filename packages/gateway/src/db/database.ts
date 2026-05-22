// @aiusb/gateway — SQLite 数据库（Phase 1 用 sql.js，后续切 better-sqlite3）
// sql.js 是纯 WebAssembly 实现，无需原生编译

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

export type Database = SqlJsDatabase;

let dbInstance: Database | null = null;

export async function initDatabase(path?: string): Promise<Database> {
  const SQL = await initSqlJs();

  // Phase 1 用内存数据库；后续可从文件加载
  if (path && path !== ':memory:') {
    // TODO: 从文件加载/持久化
    dbInstance = new SQL.Database();
  } else {
    dbInstance = new SQL.Database();
  }

  // 核心表
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS platform_sessions (
      platform TEXT NOT NULL,
      session_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (platform)
    )
  `);

  dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id)`);
  dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at)`);

  return dbInstance;
}

export function getDatabase(): Database {
  if (!dbInstance) throw new Error('Database not initialized. Call initDatabase() first.');
  return dbInstance;
}
