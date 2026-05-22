// @aiusb/gateway — 9 阶段消息流水线调度器（洋葱模型）

import type { PipelineContext, PipelineStage, InboundMessage, OutboundMessage, Session, ChatMessage } from '@aiusb/shared';
import type { EventBus } from '../events/event-bus.js';
import type { Database } from '../db/database.js';
import { STAGE_ORDER, type StageHandler } from './stages/index.js';
import {
  wakingCheckStage,
  whitelistCheckStage,
  sessionStatusStage,
  rateLimitStage,
  contentSafetyStage,
  preProcessStage,
  processStage,
  resultDecorateStage,
  respondStage,
  setLLMConfig,
  getLLMConfig,
} from './stages/impl.js';
import type { LLMConfig } from '@aiusb/shared';

export class PipelineScheduler {
  private stages: Map<string, StageHandler> = new Map();

  constructor(
    private eventBus: EventBus,
    private db: Database,
  ) {
    this.registerBuiltinStages();
  }

  /** 注册一个流水线阶段处理器 */
  register(stage: PipelineStage, handler: StageHandler): void {
    this.stages.set(stage, handler);
  }

  /**
   * 处理一条入站消息，按顺序通过所有阶段
   * 任一阶段可调用 ctx.blocked = true 终止后续处理（洋葱模型）
   */
  async process(inbound: InboundMessage, session: Session | null = null, history: ChatMessage[] = []): Promise<PipelineContext> {
    const ctx: PipelineContext = {
      eventId: crypto.randomUUID(),
      inbound,
      outbound: null,
      session,
      history,
      stageResults: {},
      blocked: false,
    };

    for (const stage of STAGE_ORDER) {
      if (ctx.blocked) break;
      const handler = this.stages.get(stage);
      if (handler) {
        try {
          await handler(ctx);
        } catch (err) {
          console.error(`[Pipeline] Stage "${stage}" error:`, err);
          ctx.blocked = true;
          ctx.blockReason = `内部错误: ${stage}`;
        }
      }
    }

    if (ctx.blocked) {
      this.eventBus.emit('pipeline:blocked', {
        ctx,
        stage: STAGE_ORDER.find((s) => {
          const result = ctx.stageResults[s];
          return result && typeof result === 'object' && 'blocked' in result && (result as Record<string, unknown>).blocked;
        }) ?? 'unknown',
        reason: ctx.blockReason ?? 'unknown',
      });
    } else {
      this.eventBus.emit('message:processed', { ctx });
    }

    return ctx;
  }

  private registerBuiltinStages(): void {
    this.stages.set('waking_check', wakingCheckStage);
    this.stages.set('whitelist_check', whitelistCheckStage);
    this.stages.set('session_status', sessionStatusStage);
    this.stages.set('rate_limit', rateLimitStage);
    this.stages.set('content_safety', contentSafetyStage);
    this.stages.set('pre_process', preProcessStage);
    this.stages.set('process', processStage);
    this.stages.set('result_decorate', resultDecorateStage);
    this.stages.set('respond', respondStage);
  }

  /** 更新全局 LLM 配置 */
  updateLLMConfig(config: LLMConfig): void {
    setLLMConfig(config);
  }

  /** 获取当前 LLM 配置 */
  getLLMConfig(): LLMConfig {
    return getLLMConfig();
  }
}
