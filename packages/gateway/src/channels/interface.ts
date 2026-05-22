// @aiusb/gateway — Channel 适配器接口

import type { InboundMessage, OutboundMessage, PlatformId } from '@aiusb/shared';

export interface PlatformMetadata {
  platform: PlatformId;
  name: string;
  capabilities: {
    maxTextLength: number;
    maxFileSizeMb: number;
    supportsImage: boolean;
    supportsAudio: boolean;
    supportsVideo: boolean;
  };
}

export interface ChannelAdapter {
  readonly meta: PlatformMetadata;

  /** 启动连接 */
  start(): Promise<void>;

  /** 优雅关闭 */
  stop(): Promise<void>;

  /** 发送消息 */
  send(message: OutboundMessage): Promise<void>;

  /** 注册入站消息处理器 */
  onMessage(handler: (msg: InboundMessage) => Promise<void>): void;

  /** 获取平台登录二维码/链接（如需） */
  getLoginUrl?(): Promise<string | null>;

  /** 检查连接状态 */
  isConnected(): boolean;
}
