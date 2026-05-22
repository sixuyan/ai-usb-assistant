// @aiusb/gateway — 子 Agent 移交系统
// 主 Agent 可将复杂任务移交给子 Agent（独立上下文 + 独立工具集）

import { createProvider } from '../llm/provider.js';
import type { LLMConfig, ToolDefinition, ChatMessage } from '@aiusb/shared';
import { capabilityRegistry } from '../capability/registry.js';

export interface SubAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];    // 工具名列表
  model?: string;            // 可覆盖模型
}

export class SubAgentManager {
  private agents = new Map<string, SubAgent>();

  register(agent: SubAgent): void {
    this.agents.set(agent.id, agent);
  }

  remove(id: string): void {
    this.agents.delete(id);
  }

  list(): SubAgent[] {
    return Array.from(this.agents.values());
  }

  /** 执行子 Agent 任务 */
  async execute(
    agentId: string,
    userMessage: string,
    llmConfig: LLMConfig,
  ): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent) return `子 Agent "${agentId}" 不存在`;

    const provider = createProvider({
      ...llmConfig,
      model: agent.model ?? llmConfig.model,
    });

    const tools = capabilityRegistry
      .getAllTools()
      .filter((t) => agent.allowedTools.includes(t.name));

    const messages: ChatMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await provider.chat(messages, tools);

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          try {
            const result = await capabilityRegistry.executeTool(tc.name, tc.arguments);
            messages.push({ role: 'tool' as const, content: result, toolCallId: tc.id } as ChatMessage);
          } catch {
            messages.push({ role: 'tool' as const, content: '工具执行失败', toolCallId: tc.id } as ChatMessage);
          }
        }
        const final = await provider.chat(messages, tools);
        return final.content;
      }

      return response.content;
    } catch (err) {
      return `子 Agent 执行失败: ${(err as Error).message}`;
    }
  }

  /** 生成 transfer 工具列表（供主 Agent 使用） */
  getTransferTools(): ToolDefinition[] {
    return Array.from(this.agents.values()).map((agent) => ({
      name: `transfer_to_${agent.id}`,
      description: `将任务移交给「${agent.name}」处理。${agent.description}`,
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: `传递给 ${agent.name} 的任务描述`,
          },
        },
        required: ['message'],
      },
    }));
  }
}

export const subAgentManager = new SubAgentManager();

// 注册默认子 Agent
subAgentManager.register({
  id: 'researcher',
  name: '研究员',
  description: '专门负责搜索信息、分析数据和总结报告',
  systemPrompt: '你是一名专业的研究分析师。请使用搜索工具查找信息，然后用简洁清晰的方式呈现结果。',
  allowedTools: ['get_weather', 'translate', 'summarize_text', 'calculate'],
});

subAgentManager.register({
  id: 'coder',
  name: '程序员',
  description: '专门负责编写和调试代码',
  systemPrompt: '你是一名专业程序员。请使用 run_code 工具执行代码，帮助用户解决编程问题。',
  allowedTools: ['run_code', 'calculate'],
});
