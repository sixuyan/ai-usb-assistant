// @aiusb/gateway — Discord 适配器（WebSocket 网关，无需公网 IP）
//
// 使用 Discord Gateway WebSocket 协议收发消息。
// 用户在 Discord Developer Portal 创建 Bot 获取 Token。

import type { InboundMessage, OutboundMessage, PlatformId } from '@aiusb/shared';
import type { ChannelAdapter, PlatformMetadata } from './interface.js';

type MessageHandler = (msg: InboundMessage) => Promise<void>;

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

export class DiscordAdapter implements ChannelAdapter {
  readonly meta: PlatformMetadata = {
    platform: 'discord',
    name: 'Discord',
    capabilities: {
      maxTextLength: 2000,
      maxFileSizeMb: 25,
      supportsImage: true,
      supportsAudio: true,
      supportsVideo: true,
    },
  };

  private ws: WebSocket | null = null;
  private handler: MessageHandler | null = null;
  private connected = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor(private token: string) {}

  async start(): Promise<void> {
    await this.connect();
  }

  async stop(): Promise<void> {
    this.connected = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async send(message: OutboundMessage): Promise<void> {
    const text = message.content
      .filter((s) => s.type === 'text')
      .map((s) => s.text ?? '')
      .join('\n');

    try {
      await fetch(`https://discord.com/api/v10/channels/${message.peerId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${this.token}`,
        },
        body: JSON.stringify({ content: text.slice(0, 2000) }),
      });
    } catch (err) {
      console.error('[Discord] Send error:', err);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ---- 内部 ----

  private connect(): void {
    this.ws = new WebSocket(GATEWAY_URL);

    this.ws.onopen = () => {
      console.log('[Discord] Gateway connected');
      // 发送 identify 消息
      this.sendGateway({
        op: 2,
        d: {
          token: this.token,
          intents: 1 << 9 | 1 << 0, // GUILD_MESSAGES | GUILDS
          properties: { os: 'windows', browser: 'aiusb', device: 'aiusb' },
        },
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          op: number;
          t?: string;
          s?: number;
          d: Record<string, unknown>;
        };
        this.seq = msg.s ?? this.seq;
        this.handleGateway(msg);
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      console.log('[Discord] Gateway disconnected, reconnecting...');
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    };
  }

  private sendGateway(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleGateway(msg: { op: number; t?: string; d: Record<string, unknown> }): void {
    switch (msg.op) {
      case 10: { // Hello
        const interval = (msg.d.heartbeat_interval as number) ?? 41250;
        this.heartbeatTimer = setInterval(() => {
          this.sendGateway({ op: 1, d: this.seq });
        }, interval);
        // 如果已有 session，重连
        if (this.sessionId) {
          this.sendGateway({
            op: 6,
            d: { token: this.token, session_id: this.sessionId, seq: this.seq },
          });
        }
        break;
      }
      case 0: { // Dispatch
        if (msg.t === 'READY') {
          this.sessionId = (msg.d.session_id as string) ?? null;
          this.connected = true;
          console.log('[Discord] Ready');
        } else if (msg.t === 'MESSAGE_CREATE' && this.handler) {
          const d = msg.d as Record<string, unknown>;
          const author = d.author as Record<string, unknown>;
          // 忽略机器人自己的消息
          if (author?.bot) break;

          const content = (d.content as string) ?? '';
          const inbound: InboundMessage = {
            id: (d.id as string) ?? crypto.randomUUID(),
            platform: 'discord' as PlatformId,
            chatType: 'group', // Discord messages are always in a guild channel
            peerId: (d.channel_id as string) ?? '',
            senderId: (author?.id as string) ?? '',
            senderName: (author?.username as string) ?? '',
            content: [{ type: 'text', text: content }],
            timestamp: Date.now(),
            isMention: content.includes('@AI助手'),
            raw: msg,
          };
          this.handler(inbound).catch((err) => console.error('[Discord] Handler error:', err));
        }
        break;
      }
    }
  }
}
