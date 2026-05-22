// @aiusb/gateway — Telegram 适配器（Long Polling 模式，无需公网 IP）
//
// 使用 Telegram Bot API 的 getUpdates 长轮询模式收发消息。
// 用户从 @BotFather 创建 Bot 并获取 Token 即可使用。

import type { InboundMessage, OutboundMessage, PlatformId } from '@aiusb/shared';
import type { ChannelAdapter, PlatformMetadata } from './interface.js';

type MessageHandler = (msg: InboundMessage) => Promise<void>;

export class TelegramAdapter implements ChannelAdapter {
  readonly meta: PlatformMetadata = {
    platform: 'telegram',
    name: 'Telegram',
    capabilities: {
      maxTextLength: 4096,
      maxFileSizeMb: 50,
      supportsImage: true,
      supportsAudio: true,
      supportsVideo: true,
    },
  };

  private handler: MessageHandler | null = null;
  private connected = false;
  private polling = false;
  private lastUpdateId = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private token: string) {}

  async start(): Promise<void> {
    this.connected = true;
    this.startPolling();
    console.log('[Telegram] Started long polling');
  }

  async stop(): Promise<void> {
    this.connected = false;
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    console.log('[Telegram] Stopped');
  }

  async send(message: OutboundMessage): Promise<void> {
    const text = message.content
      .filter((s) => s.type === 'text')
      .map((s) => s.text ?? '')
      .join('\n');

    try {
      await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: message.peerId,
          text,
          parse_mode: 'Markdown',
          reply_to_message_id: message.replyToId ? parseInt(message.replyToId) : undefined,
        }),
      });
    } catch (err) {
      console.error('[Telegram] Send error:', err);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ---- 内部 ----

  private async startPolling(): Promise<void> {
    this.polling = true;

    const poll = async () => {
      if (!this.polling || !this.connected) return;

      try {
        const res = await fetch(
          `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`,
        );
        const data = await res.json() as {
          ok: boolean;
          result?: Array<{
            update_id: number;
            message?: {
              message_id: number;
              from?: { id: number; first_name?: string };
              chat: { id: number; type: string };
              text?: string;
              photo?: Array<{ file_id: string }>;
              reply_to_message?: { message_id: number };
            };
          }>;
        };

        if (data.ok && data.result) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id;
            const msg = update.message;
            if (!msg || !this.handler) continue;

            const text = msg.text ?? '';
            const content: InboundMessage['content'] = [{ type: 'text', text }];

            if (msg.photo && msg.photo.length > 0) {
              content.push({ type: 'image', url: msg.photo[msg.photo.length - 1].file_id });
            }

            const inbound: InboundMessage = {
              id: String(msg.message_id),
              platform: 'telegram' as PlatformId,
              chatType: msg.chat.type === 'private' ? 'private' : 'group',
              peerId: String(msg.chat.id),
              senderId: String(msg.from?.id ?? ''),
              senderName: msg.from?.first_name ?? '',
              content,
              timestamp: Date.now(),
              isMention: text.includes('@AI助手') || text.includes('@bot'),
              replyToId: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
              raw: msg,
            };

            this.handler(inbound).catch((err) => console.error('[Telegram] Handler error:', err));
          }
        }
      } catch (err) {
        console.error('[Telegram] Poll error:', err);
      }

      if (this.polling) {
        this.pollTimer = setTimeout(poll, 100); // 立即发起下一次长轮询
      }
    };

    poll();
  }
}
