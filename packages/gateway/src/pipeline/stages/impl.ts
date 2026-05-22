// @aiusb/gateway — 流水线阶段实现

import type { PipelineContext, Session, ChatMessage, LLMConfig } from '@aiusb/shared';
import type { StageHandler } from './index.js';
import { createProvider } from '../../llm/provider.js';
import { MemoryManager } from '../memory.js';
import { ContentFilter } from '../../security/content-filter.js';
import { capabilityRegistry } from '../../capability/registry.js';

// 全局内容过滤器
const contentFilter = new ContentFilter();

/** 获取内容过滤器 */
export function getContentFilter(): ContentFilter {
  return contentFilter;
}

// 全局记忆管理器实例
const memory = new MemoryManager();

// 全局 LLM 配置
let llmConfig: LLMConfig = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  model: 'deepseek-chat',
};

/** 更新 LLM 配置 */
export function setLLMConfig(config: LLMConfig): void {
  llmConfig = config;
}

/** 获取当前 LLM 配置 */
export function getLLMConfig(): LLMConfig {
  return { ...llmConfig };
}

/** 获取记忆管理器 */
export function getMemory(): MemoryManager {
  return memory;
}

// ============================================================
// Stage 1: waking_check — 唤醒检查
// ============================================================
export const wakingCheckStage: StageHandler = async (ctx) => {
  // 如果是私聊，直接放行
  if (ctx.inbound.chatType === 'private') {
    ctx.stageResults.waking_check = { triggered: true, reason: 'private_chat' };
    return;
  }

  // 群聊：检查是否 @了机器人 或包含关键词
  const isMentioned = ctx.inbound.isMention;
  const hasKeyword = ctx.inbound.content.some((seg) => {
    if (seg.type === 'text' && seg.text) {
      return /^(机器人|AI|小助手|ai)/i.test(seg.text);
    }
    return false;
  });

  if (isMentioned || hasKeyword) {
    ctx.stageResults.waking_check = { triggered: true, reason: isMentioned ? 'mention' : 'keyword' };
  } else {
    ctx.blocked = true;
    ctx.blockReason = '未唤醒：需要 @机器人 或触发关键词';
    ctx.stageResults.waking_check = { triggered: false };
  }
};

// ============================================================
// Stage 2: whitelist_check — 白名单检查
// ============================================================
export const whitelistCheckStage: StageHandler = async (ctx) => {
  // Phase 1: 默认放行所有消息
  ctx.stageResults.whitelist_check = { allowed: true };
};

// ============================================================
// Stage 3: session_status — 会话状态管理
// ============================================================
export const sessionStatusStage: StageHandler = async (ctx) => {
  const session: Session = {
    id: `${ctx.inbound.platform}:${ctx.inbound.chatType}:${ctx.inbound.peerId}`,
    platform: ctx.inbound.platform,
    chatType: ctx.inbound.chatType,
    peerId: ctx.inbound.peerId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  ctx.session = session;
  ctx.stageResults.session_status = { session };
};

// ============================================================
// Stage 4: rate_limit — 速率限制
// ============================================================
export const rateLimitStage: StageHandler = async (ctx) => {
  // Phase 1: 简单实现，默认放行
  ctx.stageResults.rate_limit = { allowed: true };
};

// ============================================================
// Stage 5: content_safety — 内容安全检查
// ============================================================
export const contentSafetyStage: StageHandler = async (ctx) => {
  const text = ctx.inbound.content
    .filter((s) => s.type === 'text')
    .map((s) => s.text ?? '')
    .join(' ');

  const result = contentFilter.check(text);

  if (!result.safe) {
    const action = result.rule?.action ?? 'block';
    if (action === 'block') {
      ctx.blocked = true;
      ctx.blockReason = '内容安全检查：消息包含违规内容';
    }
    ctx.stageResults.content_safety = { safe: false, matched: result.matched, action };
    return;
  }

  ctx.stageResults.content_safety = { safe: true };
};

// ============================================================
// Stage 6: pre_process — 预处理（组装上下文）
// ============================================================
export const preProcessStage: StageHandler = async (ctx) => {
  if (!ctx.session) return;

  const conv = memory.getOrCreate(ctx.session);
  ctx.history = [...conv.messages];

  ctx.stageResults.pre_process = {
    historyLength: ctx.history.length,
    sessionId: ctx.session.id,
  };
};

// ============================================================
// Stage 7: process — 核心处理（调用 LLM + 工具调用）
// ============================================================
export const processStage: StageHandler = async (ctx) => {
  if (!llmConfig.apiKey || llmConfig.apiKey === '') {
    const text = ctx.inbound.content.find((s) => s.type === 'text')?.text ?? '';
    ctx.outbound = {
      platform: ctx.inbound.platform,
      chatType: ctx.inbound.chatType,
      peerId: ctx.inbound.peerId,
      content: [{ type: 'text', text: `[演示模式] 收到你的消息: "${text}"\n请先配置 API 密钥以启用 AI 回复。` }],
    };
    ctx.stageResults.process = { mode: 'echo' };
    return;
  }

  const provider = createProvider(llmConfig);
  const tools = capabilityRegistry.getToolsForLLM();
  const toolDefinitions = capabilityRegistry.getAllTools();

  // 组装消息
  const systemPrompt = ctx.history.find((m) => m.role === 'system');
  const messages: ChatMessage[] = [];

  if (systemPrompt) {
    messages.push(systemPrompt);
  } else {
    messages.push({
      role: 'system',
      content: '你是一个智能聊天助手。你可以使用工具来完成用户的任务。对于需要实时信息（天气、翻译、计算、搜索）的问题，请优先使用工具。',
    });
  }

  // 添加历史
  const recentHistory = ctx.history.filter((m) => m.role !== 'system').slice(-20);
  messages.push(...recentHistory);

  // 添加当前用户消息
  const userText = ctx.inbound.content
    .filter((s) => s.type === 'text')
    .map((s) => s.text ?? '')
    .join('\n');
  messages.push({ role: 'user', content: userText });

  try {
    const response = await provider.chat(messages, toolDefinitions);

    // 处理工具调用
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const tc of response.toolCalls) {
        try {
          const result = await capabilityRegistry.executeTool(tc.name, tc.arguments);
          messages.push({ role: 'tool', content: result, toolCallId: tc.id });
        } catch {
          messages.push({ role: 'tool', content: '工具调用失败', toolCallId: tc.id });
        }
      }

      // 带工具结果再次调用 LLM
      const finalResponse = await provider.chat(messages, toolDefinitions);
      if (ctx.session) {
        memory.append(ctx.session.id, { role: 'user', content: userText });
        memory.append(ctx.session.id, { role: 'assistant', content: finalResponse.content });
      }

      ctx.outbound = {
        platform: ctx.inbound.platform,
        chatType: ctx.inbound.chatType,
        peerId: ctx.inbound.peerId,
        content: [{ type: 'text', text: finalResponse.content }],
      };

      ctx.stageResults.process = { mode: 'llm_with_tools', toolCalls: response.toolCalls.map((t) => t.name) };
    } else {
      if (ctx.session) {
        memory.append(ctx.session.id, { role: 'user', content: userText });
        memory.append(ctx.session.id, { role: 'assistant', content: response.content });
      }

      ctx.outbound = {
        platform: ctx.inbound.platform,
        chatType: ctx.inbound.chatType,
        peerId: ctx.inbound.peerId,
        content: [{ type: 'text', text: response.content }],
      };

      ctx.stageResults.process = { mode: 'llm', usage: response.usage };
    }
  } catch (err) {
    console.error('[ProcessStage] LLM error:', err);
    ctx.outbound = {
      platform: ctx.inbound.platform,
      chatType: ctx.inbound.chatType,
      peerId: ctx.inbound.peerId,
      content: [{ type: 'text', text: '抱歉，AI 引擎暂时无法响应，请稍后再试。' }],
    };
    ctx.stageResults.process = { mode: 'error', error: String(err) };
  }
};

// ============================================================
// Stage 8: result_decorate — 结果装饰（格式化输出）
// ============================================================
export const resultDecorateStage: StageHandler = async (ctx) => {
  // Phase 1: 不需要额外装饰，直接透传
  ctx.stageResults.result_decorate = { decorated: true };
};

// ============================================================
// Stage 9: respond — 响应（发送消息到平台）
// ============================================================
export const respondStage: StageHandler = async (ctx) => {
  // 实际发送由外部 ChannelAdapter 完成
  ctx.stageResults.respond = { sent: true };
};
