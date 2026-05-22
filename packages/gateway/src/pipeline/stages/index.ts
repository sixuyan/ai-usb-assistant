// @aiusb/gateway — 流水线阶段定义

import type { PipelineStage, PipelineContext } from '@aiusb/shared';

/** 阶段执行顺序（洋葱模型，顺序固定） */
export const STAGE_ORDER: PipelineStage[] = [
  'waking_check',
  'whitelist_check',
  'session_status',
  'rate_limit',
  'content_safety',
  'pre_process',
  'process',
  'result_decorate',
  'respond',
];

/** 每个阶段的处理函数签名 */
export type StageHandler = (ctx: PipelineContext) => Promise<void>;
