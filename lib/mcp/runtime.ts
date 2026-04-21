/**
 * MCP 运行时实现
 *
 * 本模块实现 McpRuntimeInterface 接口，支持：
 * - 配置由调用方传入，不直接查数据库
 * - 尽力模式：单服务失败不抛错，跳过并继续
 * - 与现有 mcp-runtime 功能兼容
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type {
  McpRuntimeConfig,
  McpRuntimeDiagnostic,
  McpRuntimeResult,
  McpRuntimeInterface,
  McpServerConfig,
  McpToolConfig,
  McpServerGroupedConfig,
} from "./interface";

// ==================== 辅助函数 ====================

/**
 * 名称清洗：将非字母数字下划线字符转换为下划线
 * 用于减少非法字符带来的工具名兼容风险
 */
function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * 构建注入到 Agent 的工具名
 * 新规则：直接返回原始工具名（唯一性由Agent配置时保证）
 * 保留 usedInjectedNames 检查作为运行时兜底
 */
function buildInjectedToolName(
  toolName: string,
  usedInjectedNames: Set<string>
): string {
  // 清洗 toolName，减少非法字符带来的工具名兼容风险
  const sanitizedToolName = sanitizeName(toolName) || "tool";

  // 保留运行时兜底检查，防止意外冲突
  if (usedInjectedNames.has(sanitizedToolName)) {
    // 运行时冲突，添加后缀（理论上不应发生）
    let finalName = sanitizedToolName;
    let suffix = 2;
    while (usedInjectedNames.has(finalName)) {
      finalName = `${sanitizedToolName}_${suffix}`;
      suffix += 1;
    }
    usedInjectedNames.add(finalName);
    return finalName;
  }
  usedInjectedNames.add(sanitizedToolName);
  return sanitizedToolName;
}

/**
 * 按服务器分组工具配置
 * 避免同一服务器重复建连
 */
function groupToolsByServer(
  config: McpRuntimeConfig
): Map<string, McpServerGroupedConfig> {
  const serverConfigs = new Map<string, McpServerGroupedConfig>();

  // 首先将服务器配置加入 map
  for (const server of config.servers) {
    serverConfigs.set(server.id, {
      server,
      selectedToolNames: new Set<string>(),
    });
  }

  // 然后将工具配置按服务器分组
  for (const tool of config.tools) {
    const group = serverConfigs.get(tool.serverId);
    if (group) {
      group.selectedToolNames.add(tool.toolName);
    }
  }

  return serverConfigs;
}

// ==================== McpRuntime 类实现 ====================

/**
 * MCP 运行时类
 * 实现 McpRuntimeInterface 接口
 */
export class McpRuntime implements McpRuntimeInterface {
  // 工具集合
  private tools: ToolSet;
  // 诊断信息
  private diagnostics: McpRuntimeDiagnostic[];
  // 客户端列表（用于清理）
  private clients: MCPClient[];
  // 是否已清理
  private cleanedUp: boolean;

  constructor(
    tools: ToolSet,
    diagnostics: McpRuntimeDiagnostic[],
    clients: MCPClient[]
  ) {
    this.tools = tools;
    this.diagnostics = diagnostics;
    this.clients = clients;
    this.cleanedUp = false;
  }

  /**
   * 获取当前工具集合
   */
  getTools(): ToolSet {
    return this.tools;
  }

  /**
   * 获取诊断信息
   */
  getDiagnostics(): McpRuntimeDiagnostic[] {
    return this.diagnostics;
  }

  /**
   * 清理运行时资源（关闭连接）
   */
  async cleanup(): Promise<void> {
    // 防止重复清理
    if (this.cleanedUp) {
      return;
    }
    this.cleanedUp = true;

    // 关闭所有客户端连接
    const closeResults = await Promise.allSettled(
      this.clients.map(async (client) => {
        await client.close();
      })
    );

    // 记录关闭失败但不抛错，避免影响主流程响应
    closeResults.forEach((result, index) => {
      if (result.status === "rejected") {
        this.diagnostics.push({
          level: "warn",
          code: "SERVER_CONNECT_FAILED",
          message: "MCP客户端关闭失败",
          context: {
            clientIndex: index,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
        });
      }
    });
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 MCP 运行时实例
 * 核心策略：尽力模式，单服务失败不抛错，跳过并继续组装其他服务工具
 *
 * @param config - MCP 运行时配置（由调用方传入，不查数据库）
 * @returns MCP 运行时结果（包含 tools、cleanup、diagnostics）
 */
export async function createMcpRuntime(
  config: McpRuntimeConfig
): Promise<McpRuntimeResult> {
  // 统一维护诊断信息，返回给上层做日志输出
  const diagnostics: McpRuntimeDiagnostic[] = [];
  // 最终注入给 Agent 的 MCP 工具集合
  const tools: ToolSet = {};
  // 保存所有成功创建的 client，后续统一关闭
  const clients: MCPClient[] = [];

  // 如果没有配置，直接返回空结果
  if (config.servers.length === 0 || config.tools.length === 0) {
    return {
      tools,
      diagnostics,
      cleanup: async () => {
        // 无client时直接返回，保持接口一致
      },
    };
  }

  // 按服务器分组，避免同一服务器重复建连
  const serverGroups = groupToolsByServer(config);

  // 防止工具名冲突：记录已使用的注入名
  const usedInjectedNames = new Set<string>();

  // 逐个服务器建连并筛选 Agent 需要的工具
  for (const group of serverGroups.values()) {
    const { server, selectedToolNames } = group;

    // 若服务被禁用，则直接跳过（尽力模式）
    if (!server.enabled) {
      diagnostics.push({
        level: "warn",
        code: "SERVER_DISABLED",
        message: "MCP服务已禁用，已跳过该服务的工具挂载",
        context: {
          serverId: server.id,
          serverName: server.name,
        },
      });
      continue;
    }

    // 若该服务器没有选中工具，跳过建连
    if (selectedToolNames.size === 0) {
      continue;
    }

    let client: MCPClient | null = null;
    let remoteTools: ToolSet = {};
    try {
      // 使用配置中的 url + headers 建立 MCP 连接
      client = await createMCPClient({
        transport: {
          type: "http",
          url: server.url,
          headers: server.headers && Object.keys(server.headers).length > 0
            ? server.headers
            : undefined,
        },
      });
      // 成功后加入回收列表，确保对话结束后能 close
      clients.push(client);
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "SERVER_CONNECT_FAILED",
        message: "MCP服务连接失败，已跳过该服务",
        context: {
          serverId: server.id,
          serverName: server.name,
          serverUrl: server.url,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      continue;
    }

    try {
      // 拉取该服务器当前可提供的全部工具
      remoteTools = await client.tools() as ToolSet;
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "REMOTE_TOOLS_FETCH_FAILED",
        message: "MCP服务工具列表拉取失败，已跳过该服务",
        context: {
          serverId: server.id,
          serverName: server.name,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      continue;
    }

    // 仅注入 Agent 选中的工具（白名单）
    for (const selectedToolName of selectedToolNames) {
      const remoteTool = remoteTools[selectedToolName];
      if (!remoteTool) {
        diagnostics.push({
          level: "warn",
          code: "TOOL_NOT_FOUND_ON_SERVER",
          message: "Agent 选中的 MCP 工具未在远端服务返回中找到，已跳过",
          context: {
            serverId: server.id,
            serverName: server.name,
            toolName: selectedToolName,
          },
        });
        continue;
      }

      // 注入名直接使用工具名（唯一性由Agent配置时保证）
      const injectedToolName = buildInjectedToolName(selectedToolName, usedInjectedNames);
      tools[injectedToolName] = remoteTool;
      diagnostics.push({
        level: "info",
        code: "TOOL_MAPPED",
        message: "MCP工具挂载成功",
        context: {
          serverId: server.id,
          serverName: server.name,
          sourceToolName: selectedToolName,
          injectedToolName,
        },
      });
    }
  }

  // 运行时实例和清理函数
  const runtime = new McpRuntime(tools, diagnostics, clients);

  return {
    tools,
    cleanup: async () => {
      await runtime.cleanup();
    },
    diagnostics,
  };
}

// ==================== 导出类型 ====================

// 重导出接口类型，方便调用方使用
export type {
  McpRuntimeConfig,
  McpRuntimeDiagnostic,
  McpRuntimeResult,
  McpRuntimeInterface,
  McpServerConfig,
  McpToolConfig,
} from "./interface";