// @aiusb/gateway — 飞书长连接适配器（WebSocket 模式，无需公网 IP）
//
// 使用飞书开放平台的长连接（socket mode）收发消息。
// 需要用户在飞书开放平台创建应用并获取 App ID + App Secret。
//
// 官方文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events

import type { InboundMessage, OutboundMessage, MessageChain, PlatformId } from '@aiusb/shared';
import type { ChannelAdapter, PlatformMetadata } from './interface.js';

type MessageHandler = (msg: InboundMessage) => Promise<void>;

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  verificationToken?: string;
}

export class FeishuAdapter implements ChannelAdapter {
  readonly meta: PlatformMetadata = {
    platform: 'feishu',
    name: '飞书',
    capabilities: {
      maxTextLength: 30000,
      maxFileSizeMb: 20,
      supportsImage: true,
      supportsAudio: true,
      supportsVideo: true,
    },
  };

  private ws: WebSocket | null = null;
  private handler: MessageHandler | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tenantAccessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private config: FeishuConfig) {}

  async start(): Promise<void> {
    await this.refreshToken();
    await this.connectWebSocket();
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  async send(message: OutboundMessage): Promise<void> {
    if (!this.tenantAccessToken) await this.refreshToken();

    const body: Record<string, unknown> = {
      receive_id: message.peerId,
      msg_type: 'text',
      content: JSON.stringify({
        text: message.content
          .filter((s) => s.type === 'text')
          .map((s) => s.text ?? '')
          .join('\n'),
      }),
    };

    await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.tenantAccessToken}`,
      },
      body: JSON.stringify(body),
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** 获取飞书应用授权的 URL */
  getAuthUrl(): string {
    return `https://open.feishu.cn/open-apis/bot/v3/hook/connect?app_id=${this.config.appId}`;
  }

  // ---- 内部实现 ----

  private async refreshToken(): Promise<void> {
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: this.config.appId, app_secret: this.config.appSecret }),
    });

    if (!res.ok) throw new Error(`Feishu auth failed: ${res.status}`);

    const data = await res.json() as { tenant_access_token: string; expire: number };
    this.tenantAccessToken = data.tenant_access_token;
    this.tokenExpiry = Date.now() + (data.expire - 300) * 1000; // 提前 5 分钟刷新
  }

  private async connectWebSocket(): Promise<void> {
    if (!this.tenantAccessToken) await this.refreshToken();

    // 飞书长连接模式：获取 WebSocket 地址
    const res = await fetch(
      'https://open.feishu.cn/open-apis/bot/v2/hook/connect',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.tenantAccessToken}` },
      },
    );

    if (!res.ok) throw new Error(`Feishu WebSocket connect failed: ${res.status}`);

    const data = await res.json() as { data?: { endpoint?: string } };
    const wsUrl = data.data?.endpoint;
    if (!wsUrl) throw new Error('No WebSocket endpoint returned');

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      console.log('[Feishu] WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        this.handleEvent(msg);
      } catch (err) {
        console.error('[Feishu] Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      console.log('[Feishu] WebSocket disconnected, reconnecting in 5s...');
      this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
    };

    this.ws.onerror = (err) => {
      console.error('[Feishu] WebSocket error:', err);
    };
  }

  private handleEvent(event: Record<string, unknown>): void {
    // 飞书事件类型: im.message.receive_v1
    const type = event.type as string;
    if (type !== 'im.message.receive_v1' || !this.handler) return;

    const msg = (event.event as Record<string, unknown>)?.message as Record<string, unknown>;
    if (!msg) return;

    const content = JSON.parse((msg.content as string) ?? '{}');
    const text = content.text ?? '';

    const inbound: InboundMessage = {
      id: (msg.message_id as string) ?? crypto.randomUUID(),
      platform: 'feishu' as PlatformId,
      chatType: (msg.chat_type as string) === 'p2p' ? 'private' : 'group',
      peerId: (msg.chat_id as string) ?? '',
      senderId: ((event.event as Record<string, unknown>)?.sender as Record<string, unknown>)?.sender_id as string ?? '',
      senderName: '',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
      isMention: text.includes('@机器人') || text.includes('@AI助手'),
      raw: event,
    };

    this.handler(inbound).catch((err) => console.error('[Feishu] Handler error:', err));
  }
}
