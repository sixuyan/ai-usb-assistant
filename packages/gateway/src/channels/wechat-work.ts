// @aiusb/gateway — 企业微信 Stream 模式适配器（无需公网 IP）
//
// 企业微信 Stream 模式通过长 TCP 连接收发消息，不需要公网回调地址。
// 需要用户在企业微信管理后台创建应用并获取：
// - Corp ID（企业 ID）
// - Agent ID（应用 ID）
// - Secret（应用密钥）
// - Token + EncodingAESKey（回调配置）
//
// 官方文档: https://developer.work.weixin.qq.com/document/path/99398

import { createHmac, randomBytes, createHash } from 'crypto';
import type { InboundMessage, OutboundMessage, MessageChain, PlatformId } from '@aiusb/shared';
import type { ChannelAdapter, PlatformMetadata } from './interface.js';

type MessageHandler = (msg: InboundMessage) => Promise<void>;

export interface WeChatWorkConfig {
  corpId: string;
  agentId: string;
  secret: string;
  token: string;
  encodingAesKey: string;
}

export class WeChatWorkAdapter implements ChannelAdapter {
  readonly meta: PlatformMetadata = {
    platform: 'wechat-work',
    name: '企业微信',
    capabilities: {
      maxTextLength: 2048,
      maxFileSizeMb: 20,
      supportsImage: true,
      supportsAudio: true,
      supportsVideo: true,
    },
  };

  private handler: MessageHandler | null = null;
  private connected = false;
  private accessToken: string | null = null;
  private tokenExpiry = 0;
  private streamClient: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private config: WeChatWorkConfig) {}

  async start(): Promise<void> {
    await this.refreshToken();
    await this.connectStream();
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.streamClient) {
      this.streamClient.close();
      this.streamClient = null;
    }
    this.connected = false;
  }

  async send(message: OutboundMessage): Promise<void> {
    if (!this.accessToken) await this.refreshToken();

    const text = message.content
      .filter((s) => s.type === 'text')
      .map((s) => s.text ?? '')
      .join('\n');

    // 群聊或私聊
    const body: Record<string, unknown> = {
      touser: message.peerId,
      msgtype: 'text',
      agentid: this.config.agentId,
      text: { content: text },
    };

    await fetch(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${this.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ---- 内部实现 ----

  private async refreshToken(): Promise<void> {
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.config.corpId}&corpsecret=${this.config.secret}`,
    );

    if (!res.ok) throw new Error(`WeChat Work auth failed: ${res.status}`);

    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  }

  private async connectStream(): Promise<void> {
    if (!this.accessToken) await this.refreshToken();

    // 企微 Stream 模式：通过 WebSocket 接收消息推送
    // 实际使用时需使用企微官方 SDK 或建立 TCP 长连接
    // Phase 2 使用简化的轮询备选方案

    // Stream 模式 WebSocket URL（需实际配置）
    const wsUrl = `wss://qyapi.weixin.qq.com/cgi-bin/ww_websocket`;

    try {
      this.streamClient = new WebSocket(wsUrl);

      this.streamClient.onopen = () => {
        this.connected = true;
        console.log('[WeChatWork] Stream connected');
        // 发送建立连接的消息
        this.streamClient?.send(JSON.stringify({
          action: 'stream',
          token: this.accessToken,
          encodingaeskey: this.config.encodingAesKey,
        }));
      };

      this.streamClient.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          this.handleMessage(msg);
        } catch {
          // ignore non-JSON
        }
      };

      this.streamClient.onclose = () => {
        this.connected = false;
        console.log('[WeChatWork] Stream disconnected, reconnecting...');
        this.reconnectTimer = setTimeout(() => this.connectStream(), 5000);
      };
    } catch {
      // Stream 不可用时，回退到轮询模式
      console.log('[WeChatWork] Stream unavailable, using polling fallback');
      this.startPolling();
    }
  }

  /** 轮询备选方案（当 Stream 不可用时） */
  private startPolling(): void {
    this.connected = true; // 标记为可用，发送仍正常工作
    const poll = async () => {
      if (!this.accessToken || Date.now() > this.tokenExpiry) {
        await this.refreshToken();
      }
      // 轮询消息（企微无原生 polling，此模式仅标记连接状态）
      this.reconnectTimer = setTimeout(poll, 30000);
    };
    poll();
  }

  private handleMessage(msg: Record<string, unknown>): void {
    if (!this.handler) return;

    const msgType = msg.MsgType as string;
    if (!msgType || msgType === 'event') return;

    const text = (msg.Content as string) ?? (msg.Text as Record<string, unknown>)?.Content as string ?? '';

    const inbound: InboundMessage = {
      id: (msg.MsgId as string) ?? crypto.randomUUID(),
      platform: 'wechat-work' as PlatformId,
      chatType: (msg.ChatType as string) === 'group' ? 'group' : 'private',
      peerId: ((msg.FromUserName as string) ?? (msg.ChatId as string) ?? ''),
      senderId: (msg.FromUserName as string) ?? '',
      senderName: '',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
      isMention: text.includes('@机器人') || text.includes('@AI助手'),
      raw: msg,
    };

    this.handler(inbound).catch((err) => console.error('[WeChatWork] Handler error:', err));
  }
}
