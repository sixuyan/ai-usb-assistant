// @aiusb/gateway — 代码沙箱（使用 Node.js 内置 vm 模块）
// Phase 2 使用 node:vm，Phase 3 可升级为 isolated-vm 以获更强隔离

import { Script, createContext } from 'node:vm';
import type { Capability } from '../capability/registry.js';

export interface SandboxResult {
  output: string;
  error?: string;
  durationMs: number;
  truncated: boolean;
}

const DEFAULT_TIMEOUT_MS = 5000;

/** 在沙箱中安全执行 JavaScript 代码 */
export async function runSandbox(
  code: string,
  options: { timeoutMs?: number } = {},
): Promise<SandboxResult> {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();
  const outputLines: string[] = [];
  let truncated = false;

  try {
    const sandbox = {
      console: {
        log: (...args: unknown[]) => outputLines.push(args.map(String).join(' ')),
        error: (...args: unknown[]) => outputLines.push('[ERROR] ' + args.map(String).join(' ')),
        warn: (...args: unknown[]) => outputLines.push('[WARN] ' + args.map(String).join(' ')),
      },
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      String,
      Number,
      Boolean,
      Array,
      Object,
      Map,
      Set,
      RegExp,
      Error,
      setTimeout: undefined, // 禁止异步延迟
      setInterval: undefined,
      fetch: undefined,
      require: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
    };

    const ctx = createContext(sandbox);

    const script = new Script(code, {
      filename: 'sandbox.js',
    });

    const result = script.runInContext(ctx);

    let output = outputLines.join('\n');

    if (result !== undefined && result !== null) {
      if (output) output += '\n';
      output += '=> ' + String(result);
    }

    if (output.length > 10000) {
      output = output.slice(0, 10000) + '\n... (输出已截断)';
      truncated = true;
    }

    return {
      output: output || '(无输出)',
      durationMs: Date.now() - start,
      truncated,
    };
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    return {
      output: outputLines.join('\n'),
      error: msg.includes('timed out') || msg.includes('Script execution timed out') ? '代码执行超时' : msg,
      durationMs: Date.now() - start,
      truncated,
    };
  }
}

export const sandboxCapability: Capability = {
  meta: {
    id: 'sandbox',
    name: '代码执行',
    icon: '💻',
    description: '在安全沙箱中执行 JavaScript 代码',
    version: '1.0.0',
    category: 'productivity',
  },
  tools: [
    {
      definition: {
        name: 'run_code',
        description: '在隔离沙箱中安全执行 JavaScript 代码并返回结果',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: '要执行的 JavaScript 代码' },
          },
          required: ['code'],
        },
      },
      execute: async (args) => {
        const code = args.code as string;
        const result = await runSandbox(code);
        if (result.error) return `执行出错: ${result.error}\n输出: ${result.output}`;
        return `执行完成 (${result.durationMs}ms):\n${result.output}`;
      },
    },
  ],
};
