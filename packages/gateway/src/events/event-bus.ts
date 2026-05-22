// @aiusb/gateway — 事件总线（基于 EventEmitter，解耦模块间通信）

import { EventEmitter } from 'events';
import type { InboundMessage, OutboundMessage, PipelineContext } from '@aiusb/shared';

export type EventName =
  | 'message:received'       // 收到平台消息
  | 'message:processed'      // 流水线处理完成
  | 'message:send'           // 发送消息到平台
  | 'pipeline:blocked'       // 消息被流水线拦截
  | 'config:changed'         // 配置变更
  | 'platform:connected'     // 平台连接成功
  | 'platform:disconnected'; // 平台断开

export interface EventMap {
  'message:received': { message: InboundMessage };
  'message:processed': { ctx: PipelineContext };
  'message:send': { message: OutboundMessage };
  'pipeline:blocked': { ctx: PipelineContext; stage: string; reason: string };
  'config:changed': { key: string; value: unknown };
  'platform:connected': { platform: string };
  'platform:disconnected': { platform: string; error?: string };
}

export class EventBus {
  private emitter = new EventEmitter();

  emit<K extends EventName>(event: K, data: EventMap[K]): void {
    this.emitter.emit(event, data);
  }

  on<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.on(event, handler);
  }

  off<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  /** 等待某个事件的下一次触发 */
  once<K extends EventName>(event: K): Promise<EventMap[K]> {
    return new Promise((resolve) => {
      this.emitter.once(event, (data) => resolve(data as EventMap[K]));
    });
  }
}
