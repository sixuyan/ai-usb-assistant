// @aiusb/gateway — 对话记忆管理（会话级 + 自动压缩）

import type { ChatMessage, Session } from '@aiusb/shared';

const MAX_HISTORY_ROUNDS = 20; // 最多保留 20 轮对话
const MAX_CONTEXT_CHARS = 8000; // 超过此长度自动压缩

export interface ConversationMemory {
  session: Session;
  messages: ChatMessage[];
}

export class MemoryManager {
  private conversations = new Map<string, ConversationMemory>();

  /** 获取或创建会话 */
  getOrCreate(session: Session): ConversationMemory {
    const key = session.id;
    let conv = this.conversations.get(key);
    if (!conv) {
      conv = { session, messages: [] };
      this.conversations.set(key, conv);
    }
    return conv;
  }

  /** 添加消息到会话 */
  append(sessionId: string, message: ChatMessage): void {
    const conv = this.conversations.get(sessionId);
    if (conv) {
      conv.messages.push(message);
      this.trim(conv);
    }
  }

  /** 获取会话历史 */
  getHistory(sessionId: string): ChatMessage[] {
    return this.conversations.get(sessionId)?.messages ?? [];
  }

  /** 清除会话 */
  clear(sessionId: string): void {
    this.conversations.delete(sessionId);
  }

  /** 自动压缩：超长时保留最近的消息 */
  private trim(conv: ConversationMemory): void {
    const msgs = conv.messages;

    // 按轮次裁剪
    if (msgs.length > MAX_HISTORY_ROUNDS * 2) {
      const excess = msgs.length - MAX_HISTORY_ROUNDS * 2;
      conv.messages = msgs.slice(excess);
    }

    // 按字符数裁剪
    let totalChars = 0;
    for (const m of conv.messages) {
      totalChars += m.content.length;
    }
    while (totalChars > MAX_CONTEXT_CHARS && conv.messages.length > 4) {
      const removed = conv.messages.splice(0, 2); // 每轮移除一对 user+assistant
      totalChars -= removed.reduce((sum, m) => sum + m.content.length, 0);
    }
  }
}
