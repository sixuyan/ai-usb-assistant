// @aiusb/gateway — MCP 协议客户端
// Model Context Protocol — 连接外部工具服务器，自动发现和注册工具

import type { ToolDefinition } from '@aiusb/shared';

export interface MCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  command?: string;      // stdio: 命令路径
  args?: string[];        // stdio: 命令参数
  url?: string;           // http: 服务器 URL
  connected: boolean;
  tools: ToolDefinition[];
}

export class MCPClient {
  private servers = new Map<string, MCPServer>();

  /** 注册 MCP 服务器 */
  async connect(config: {
    name: string;
    transport: 'stdio' | 'http';
    command?: string;
    args?: string[];
    url?: string;
  }): Promise<MCPServer> {
    const id = crypto.randomUUID();
    const server: MCPServer = {
      id,
      name: config.name,
      transport: config.transport,
      command: config.command,
      args: config.args,
      url: config.url,
      connected: false,
      tools: [],
    };

    if (config.transport === 'http' && config.url) {
      try {
        const res = await fetch(`${config.url}/tools/list`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json() as { tools?: ToolDefinition[] };
          server.tools = data.tools ?? [];
          server.connected = true;
        }
      } catch (err) {
        console.error(`[MCP] Failed to connect to ${config.name}:`, err);
      }
    } else if (config.transport === 'stdio' && config.command) {
      // stdio transport: spawn process and communicate via JSON-RPC
      // Phase 2 简化：标记为已配置，实际连接需 Phase 3 实现进程通信
      server.connected = false;
      server.tools = [];
      console.log(`[MCP] Stdio server registered: ${config.name} (${config.command})`);
    }

    this.servers.set(id, server);
    return server;
  }

  /** 断开 MCP 服务器 */
  disconnect(id: string): void {
    this.servers.delete(id);
  }

  /** 获取所有已注册的服务器 */
  list(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /** 获取所有已发现的外部工具 */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.servers.values())
      .filter((s) => s.connected)
      .flatMap((s) => s.tools);
  }
}

export const mcpClient = new MCPClient();
