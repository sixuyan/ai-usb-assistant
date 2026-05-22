// @aiusb/gateway — 定时任务管理器（基于 node-cron）

import cron from 'node-cron';

export interface CronJob {
  id: string;
  name: string;
  cronExpression: string;    // e.g. "0 8 * * *" for daily 8am
  action: 'send_message' | 'run_prompt';
  target: {
    platform?: string;
    peerId?: string;          // 群/会话 ID
    text?: string;            // 要发送的消息
    prompt?: string;          // 要运行的 prompt
  };
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export class CronManager {
  private jobs = new Map<string, { task: cron.ScheduledTask; config: CronJob }>();

  /** 创建定时任务 */
  create(config: Omit<CronJob, 'id' | 'lastRun' | 'nextRun'>): CronJob {
    const id = crypto.randomUUID();
    const job: CronJob = { ...config, id };

    if (cron.validate(config.cronExpression)) {
      const task = cron.schedule(config.cronExpression, () => {
        if (job.enabled) {
          job.lastRun = Date.now();
          this.executeJob(job);
        }
      });

      if (!config.enabled) task.stop();

      this.jobs.set(id, { task, config: job });
    }

    return job;
  }

  /** 删除定时任务 */
  delete(id: string): boolean {
    const entry = this.jobs.get(id);
    if (entry) {
      entry.task.stop();
      this.jobs.delete(id);
      return true;
    }
    return false;
  }

  /** 启用/禁用 */
  toggle(id: string, enabled: boolean): boolean {
    const entry = this.jobs.get(id);
    if (entry) {
      entry.config.enabled = enabled;
      if (enabled) entry.task.start();
      else entry.task.stop();
      return true;
    }
    return false;
  }

  /** 获取所有任务 */
  list(): CronJob[] {
    return Array.from(this.jobs.values()).map((e) => ({
      ...e.config,
    }));
  }

  /** 手动触发一次 */
  trigger(id: string): boolean {
    const entry = this.jobs.get(id);
    if (entry) {
      void this.executeJob(entry.config);
      return true;
    }
    return false;
  }

  /** 销毁所有任务 */
  destroy(): void {
    for (const entry of this.jobs.values()) {
      entry.task.stop();
    }
    this.jobs.clear();
  }

  // ---- 内部 ----

  private async executeJob(job: CronJob): Promise<void> {
    console.log(`[Cron] Executing: ${job.name}`);

    if (job.action === 'send_message' && job.target.text) {
      // 通过事件总线发送消息（由 MessagePipeline 处理）
      console.log(`[Cron] Scheduled message to ${job.target.peerId}: ${job.target.text.slice(0, 50)}`);
    } else if (job.action === 'run_prompt' && job.target.prompt) {
      console.log(`[Cron] Running prompt: ${job.target.prompt.slice(0, 50)}`);
    }
  }
}
