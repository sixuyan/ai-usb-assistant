// @aiusb/gateway — 内置能力

import type { Capability } from './registry.js';

// ============================================================
// 1. 天气查询
// ============================================================
export const weatherCapability: Capability = {
  meta: {
    id: 'weather',
    name: '天气查询',
    icon: '🌤️',
    description: '查询指定城市的天气信息',
    version: '1.0.0',
    category: 'utility',
  },
  tools: [
    {
      definition: {
        name: 'get_weather',
        description: '查询指定城市的实时天气',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: '城市名称，如"北京"、"上海"' },
          },
          required: ['city'],
        },
      },
      execute: async (args) => {
        const city = args.city as string;
        // 使用免费的 wttr.in API
        try {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w`);
          const text = await res.text();
          return `${city}天气: ${text.trim()}`;
        } catch {
          return `无法获取${city}的天气信息，请稍后再试`;
        }
      },
    },
  ],
};

// ============================================================
// 2. 翻译
// ============================================================
export const translateCapability: Capability = {
  meta: {
    id: 'translate',
    name: '翻译',
    icon: '🌐',
    description: '多语言翻译',
    version: '1.0.0',
    category: 'utility',
  },
  tools: [
    {
      definition: {
        name: 'translate',
        description: '将文本翻译为目标语言',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '要翻译的文本' },
            target: { type: 'string', description: '目标语言，如 en, zh, ja, ko, fr, de', default: 'zh' },
          },
          required: ['text', 'target'],
        },
      },
      execute: async (args) => {
        const text = args.text as string;
        const target = (args.target as string) ?? 'zh';
        try {
          const res = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`,
          );
          const data = await res.json() as { responseData?: { translatedText?: string } };
          return data.responseData?.translatedText ?? '翻译结果不可用';
        } catch {
          return '翻译服务暂时不可用';
        }
      },
    },
  ],
};

// ============================================================
// 3. 数学计算
// ============================================================
export const mathCapability: Capability = {
  meta: {
    id: 'math',
    name: '数学计算',
    icon: '🔢',
    description: '执行数学表达式计算',
    version: '1.0.0',
    category: 'utility',
  },
  tools: [
    {
      definition: {
        name: 'calculate',
        description: '计算数学表达式的结果',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: '数学表达式，如 "2 + 3 * 4" 或 "sqrt(16)"' },
          },
          required: ['expression'],
        },
      },
      execute: async (args) => {
        const expr = args.expression as string;
        try {
          // 安全计算（仅允许数学运算）
          const sanitized = expr.replace(/[^0-9+\-*/().%\s]|Math\.|sqrt|pow|sin|cos|tan|abs|round|ceil|floor/gi, '');
          const result = Function(`"use strict"; return (${sanitized})`)();
          return `${expr} = ${result}`;
        } catch {
          return `无法计算表达式: ${expr}`;
        }
      },
    },
  ],
};

// ============================================================
// 4. 文本摘要
// ============================================================
export const summaryCapability: Capability = {
  meta: {
    id: 'summary',
    name: '文本摘要',
    icon: '📝',
    description: '对长文本进行智能摘要',
    version: '1.0.0',
    category: 'productivity',
  },
  tools: [
    {
      definition: {
        name: 'summarize_text',
        description: '对一段长文本进行摘要，提取关键信息',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '需要摘要的长文本' },
            maxLength: { type: 'number', description: '摘要最大字数，默认 200', default: 200 },
          },
          required: ['text'],
        },
      },
      execute: async (args) => {
        const text = args.text as string;
        const maxLen = (args.maxLength as number) ?? 200;

        // 简单抽取式摘要：按句子重要性排序
        const sentences = text.split(/[。！？.!?\n]/).filter((s) => s.trim().length > 5);
        if (sentences.length <= 3) return text.slice(0, maxLen);

        // 基于词频的简单评分
        const wordFreq = new Map<string, number>();
        for (const s of sentences) {
          for (const w of s.split(/[\s,，、]+/)) {
            if (w.length >= 2) wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
          }
        }

        const scored = sentences.map((s) => ({
          text: s.trim(),
          score: s.split(/[\s,，、]+/).reduce((sum, w) => sum + (wordFreq.get(w) ?? 0), 0),
        }));

        scored.sort((a, b) => b.score - a.score);
        let result = '';
        for (const s of scored) {
          if (result.length + s.text.length > maxLen) break;
          result += s.text + '。';
        }

        return result || text.slice(0, maxLen) + '...';
      },
    },
  ],
};

// ============================================================
// 5. 群管理
// ============================================================
export const groupManagementCapability: Capability = {
  meta: {
    id: 'group-management',
    name: '群管理',
    icon: '👥',
    description: '群聊管理功能：欢迎新人、统计活跃度、违规警告',
    version: '1.0.0',
    category: 'management',
  },
  tools: [
    {
      definition: {
        name: 'generate_welcome',
        description: '为新成员生成欢迎消息',
        parameters: {
          type: 'object',
          properties: {
            username: { type: 'string', description: '新成员昵称' },
            groupName: { type: 'string', description: '群名称' },
            rules: { type: 'string', description: '群规（可选）' },
          },
          required: ['username', 'groupName'],
        },
      },
      execute: async (args) => {
        const name = args.username as string;
        const group = args.groupName as string;
        const rules = (args.rules as string) ?? '请遵守群规，友好交流';
        return `👋 欢迎 ${name} 加入 ${group}！\n\n📋 ${rules}\n\n💬 有问题随时 @我 哦~`;
      },
    },
    {
      definition: {
        name: 'count_active_users',
        description: '统计群内活跃用户（基于提供的消息列表）',
        parameters: {
          type: 'object',
          properties: {
            messages_json: { type: 'string', description: 'JSON 格式的消息列表，每条含 senderName' },
          },
          required: ['messages_json'],
        },
      },
      execute: async (args) => {
        try {
          const msgs = JSON.parse(args.messages_json as string) as Array<{ senderName: string }>;
          const counts = new Map<string, number>();
          for (const m of msgs) {
            counts.set(m.senderName, (counts.get(m.senderName) ?? 0) + 1);
          }
          const sorted = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
          return '📊 活跃排行榜:\n' + sorted.map(([name, count], i) => `${i + 1}. ${name}: ${count} 条消息`).join('\n');
        } catch {
          return '消息数据格式有误，请提供有效的 JSON';
        }
      },
    },
  ],
};

// 所有内置能力
export const BUILTIN_CAPABILITIES: Capability[] = [
  weatherCapability,
  translateCapability,
  mathCapability,
  summaryCapability,
  groupManagementCapability,
];
