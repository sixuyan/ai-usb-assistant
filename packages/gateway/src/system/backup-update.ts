// @aiusb/gateway — 备份迁移 + 自动更新

import type { Database } from '../db/database.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================
// 备份 & 恢复
// ============================================================

export interface BackupMeta {
  version: string;
  createdAt: string;
  tables: string[];
}

/** 导出全量配置 + 数据库到 JSON */
export function exportBackup(db: Database): { meta: BackupMeta; data: Record<string, unknown[]> } {
  const tables = [
    'config', 'conversations', 'user_memory', 'long_term_memory',
    'knowledge_docs', 'knowledge_chunks', 'platform_sessions',
  ];

  const data: Record<string, unknown[]> = {};

  for (const table of tables) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      data[table] = rows;
    } catch {
      data[table] = [];
    }
  }

  return {
    meta: {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      tables,
    },
    data,
  };
}

/** 保存备份到文件 */
export function saveBackupToFile(db: Database, filepath?: string): string {
  const path = filepath ?? join(process.env.USERPROFILE ?? '~', 'Desktop', `aiusb-backup-${Date.now()}.json`);
  const backup = exportBackup(db);
  writeFileSync(path, JSON.stringify(backup, null, 2), 'utf-8');
  return path;
}

/** 从文件恢复备份 */
export function restoreBackupFromFile(db: Database, filepath: string): BackupMeta {
  const content = readFileSync(filepath, 'utf-8');
  const backup = JSON.parse(content) as ReturnType<typeof exportBackup>;

  for (const [table, rows] of Object.entries(backup.data)) {
    if (rows.length === 0) continue;
    // 清空表后重新插入
    db.run(`DELETE FROM ${table}`);
    for (const row of rows) {
      const cols = Object.keys(row as Record<string, unknown>);
      const placeholders = cols.map(() => '?').join(',');
      const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
      stmt.run(cols.map((c) => (row as Record<string, unknown>)[c]));
    }
  }

  return backup.meta;
}

// ============================================================
// 自动更新
// ============================================================

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl?: string;
  releaseNotes?: string;
}

const GITHUB_API = 'https://api.github.com/repos/user/ai-usb-assistant/releases/latest';

/** 检查更新（从 GitHub Releases） */
export async function checkForUpdates(currentVersion: string): Promise<UpdateInfo> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { currentVersion, latestVersion: null, hasUpdate: false };
    }

    const release = await res.json() as {
      tag_name?: string;
      html_url?: string;
      body?: string;
    };

    const latest = release.tag_name?.replace(/^v/, '') ?? null;
    const hasUpdate = latest ? compareVersions(latest, currentVersion) > 0 : false;

    return {
      currentVersion,
      latestVersion: latest,
      hasUpdate,
      releaseUrl: release.html_url,
      releaseNotes: release.body,
    };
  } catch {
    return { currentVersion, latestVersion: null, hasUpdate: false };
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
