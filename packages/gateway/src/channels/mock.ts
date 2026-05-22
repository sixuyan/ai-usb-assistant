// @aiusb/gateway — Mock Channel（Phase 1 测试用，模拟 IM 平台消息）

import type { InboundMessage, OutboundMessage, PlatformId } from '@aiusb/shared';
import type { ChannelAdapter, PlatformMetadata } from './interface.js';

type MessageHandler = (msg: InboundMessage) => Promise<void>;

/** 创建一个模拟的平台适配器，用于开发和测试 */
export function createMockChannel(platform: PlatformId, name: string): ChannelAdapter & { simulateMessage(msg: InboundMessage): void } {
  let handler: MessageHandler | null = null;
  let connected = false;

  const meta: PlatformMetadata = {
    platform,
    name,
    capabilities: {
      maxTextLength: 4000,
      maxFileSizeMb: 10,
      supportsImage: true,
      supportsAudio: false,
      supportsVideo: false,
    },
  };

  return {
    meta,

    async start() {
      connected = true;
      console.log(`[MockChannel:${platform}] Started`);
    },

    async stop() {
      connected = false;
      console.log(`[MockChannel:${platform}] Stopped`);
    },

    async send(message: OutboundMessage) {
      console.log(`[MockChannel:${platform}] Sending:`, JSON.stringify(message.content));
    },

    onMessage(h: MessageHandler) {
      handler = h;
    },

    isConnected() {
      return connected;
    },

    /** 模拟接收一条消息（测试用） */
    simulateMessage(msg: InboundMessage) {
      if (handler) {
        handler(msg).catch((err) => console.error(`[MockChannel:${platform}] Handler error:`, err));
      }
    },
  };
}
