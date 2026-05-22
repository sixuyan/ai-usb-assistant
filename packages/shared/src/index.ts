// ============================================================
// @aiusb/shared — 统一类型定义
// 贯穿 desktop ↔ gateway 的所有核心数据结构
// ============================================================

// ---- 消息类型 ----

/** 平台标识 */
export type PlatformId = 'qq' | 'wechat-work' | 'feishu' | 'dingtalk' | 'telegram' | 'discord' | 'slack' | 'line' | 'webchat';

/** 会话类型 */
export type ChatType = 'private' | 'group' | 'channel';

/** 消息元素类型 */
export type MessageSegmentType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'at' | 'reply';

/** 单个消息片段 */
export interface MessageSegment {
  type: MessageSegmentType;
  text?: string;
  url?: string;
  fileId?: string;
  userId?: string;      // for @ mentions
  duration?: number;     // audio/video duration in seconds
}

/** 消息链（一条消息可包含多个元素，如 文字+图片） */
export type MessageChain = MessageSegment[];

/** 标准化入站消息（所有平台归一化为此格式） */
export interface InboundMessage {
  id: string;
  platform: PlatformId;
  chatType: ChatType;
  peerId: string;        // 群ID / 私聊对象ID
  senderId: string;
  senderName: string;
  content: MessageChain;
  timestamp: number;
  isMention: boolean;    // 是否 @了机器人
  replyToId?: string;    // 引用回复的消息ID
  raw: unknown;          // 平台原始数据（调试用）
}

/** 标准化出站消息 */
export interface OutboundMessage {
  platform: PlatformId;
  chatType: ChatType;
  peerId: string;
  content: MessageChain;
  replyToId?: string;
}

// ---- 会话 ----

export interface Session {
  id: string;            // 格式: {platform}:{chatType}:{peerId}
  platform: PlatformId;
  chatType: ChatType;
  peerId: string;
  createdAt: number;
  updatedAt: number;
}

// ---- LLM 相关 ----

export interface LLMConfig {
  baseUrl: string;       // API 地址
  apiKey: string;        // API 密钥
  model: string;         // 模型名称
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

// ---- 流水线 ----

/** 流水线阶段名称 */
export type PipelineStage =
  | 'waking_check'
  | 'whitelist_check'
  | 'session_status'
  | 'rate_limit'
  | 'content_safety'
  | 'pre_process'
  | 'process'
  | 'result_decorate'
  | 'respond';

/** 流水线上下文（贯穿各阶段） */
export interface PipelineContext {
  eventId: string;
  inbound: InboundMessage;
  outbound: OutboundMessage | null;
  session: Session | null;
  history: ChatMessage[];
  stageResults: Partial<Record<PipelineStage, unknown>>;
  blocked: boolean;
  blockReason?: string;
}

// ---- 场景 & 配置 ----

export interface SceneTemplate {
  id: string;
  name: string;              // 用户看到的名称，如 "QQ群管家"
  icon: string;              // emoji
  description: string;
  systemPrompt: string;
  defaultTools: string[];    // 默认开启的能力
  replyStrategy: 'mention_only' | 'keyword' | 'all';
  keywords?: string[];
  platforms: PlatformId[];
}

export interface UserConfig {
  llm: LLMConfig;
  scenes: SceneTemplate[];
  activeSceneId: string | null;
  platforms: Record<PlatformId, PlatformAuth>;
  settings: UserSettings;
}

export interface PlatformAuth {
  enabled: boolean;
  credentials?: Record<string, string>;
  targetGroups?: string[];
}

export interface UserSettings {
  replyFrequency: 'fast' | 'normal' | 'slow';
  contentFilter: boolean;
  webSearch: boolean;
  voiceReply: boolean;
  adminIds: string[];
}
