// @aiusb/gateway — 能力系统（插件/Capability 框架）

import type { ToolDefinition, ToolCall } from '@aiusb/shared';

export interface CapabilityMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  version: string;
  category: 'utility' | 'entertainment' | 'productivity' | 'management';
}

export interface CapabilityTool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}

export interface Capability {
  meta: CapabilityMeta;
  tools: CapabilityTool[];
  /** 启动时调用 */
  onInit?(): Promise<void>;
  /** 卸载时调用 */
  onDestroy?(): Promise<void>;
}

class CapabilityRegistry {
  private capabilities = new Map<string, Capability>();

  register(cap: Capability): void {
    this.capabilities.set(cap.meta.id, cap);
    console.log(`[Capability] Registered: ${cap.meta.name} (${cap.tools.length} tools)`);
  }

  unregister(id: string): void {
    const cap = this.capabilities.get(id);
    if (cap) {
      cap.onDestroy?.();
      this.capabilities.delete(id);
    }
  }

  getAll(): CapabilityMeta[] {
    return Array.from(this.capabilities.values()).map((c) => c.meta);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.capabilities.values()).flatMap((c) =>
      c.tools.map((t) => t.definition),
    );
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    for (const cap of this.capabilities.values()) {
      const tool = cap.tools.find((t) => t.definition.name === name);
      if (tool) {
        return tool.execute(args);
      }
    }
    throw new Error(`Tool not found: ${name}`);
  }

  getToolsForLLM(): Array<{ type: 'function'; function: ToolDefinition }> {
    return this.getAllTools().map((t) => ({
      type: 'function' as const,
      function: t,
    }));
  }

  async initAll(): Promise<void> {
    for (const cap of this.capabilities.values()) {
      await cap.onInit?.();
    }
  }
}

export const capabilityRegistry = new CapabilityRegistry();
