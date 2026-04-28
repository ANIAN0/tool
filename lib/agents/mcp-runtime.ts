/**
 * MCP 运行时适配器
 * 桥接外部配置和 MCP 运行时
 * 不依赖数据库，配置通过参数传入
 */

import type { ToolSet } from 'ai';
import { createMcpRuntime } from '@/lib/infra/mcp';
import type { McpServerConfig, McpToolConfig, McpRuntimeDiagnostic } from '@/lib/infra/mcp';

/**
 * MCP 运行时工具构建结果
 */
export interface AgentMcpRuntimeToolsResult {
  tools: ToolSet;
  cleanup: () => Promise<void>;
  diagnostics: McpRuntimeDiagnostic[];
}

/**
 * 根据外部配置构建 MCP 运行时工具（适配器模式）
 * 配置通过参数传入，不依赖数据库
 */
export async function createAgentMcpRuntimeTools(params: {
  servers: McpServerConfig[];
  tools: McpToolConfig[];
}): Promise<AgentMcpRuntimeToolsResult> {
  const { servers, tools } = params;

  // 无配置时返回空结果
  if (servers.length === 0 || tools.length === 0) {
    return {
      tools: {},
      cleanup: async () => {},
      diagnostics: [],
    };
  }

  // 调用无 DB 耦合的 MCP 运行时
  const result = await createMcpRuntime({ servers, tools });

  return {
    tools: result.tools,
    cleanup: result.cleanup,
    diagnostics: result.diagnostics as McpRuntimeDiagnostic[],
  };
}