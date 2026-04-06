import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { getAgentMcpRuntimeToolConfigs } from "@/lib/db";

/**
 * MCP运行时诊断信息
 * 用于记录“跳过服务”“工具不存在”等降级细节，便于排查
 */
export interface McpRuntimeDiagnostic {
  // 诊断级别
  level: "info" | "warn" | "error";
  // 诊断代码，方便日志聚合
  code:
    | "SERVER_DISABLED"
    | "SERVER_CONNECT_FAILED"
    | "REMOTE_TOOLS_FETCH_FAILED"
    | "TOOL_NOT_FOUND_ON_SERVER"
    | "TOOL_MAPPED";
  // 人类可读信息
  message: string;
  // 扩展上下文
  context?: Record<string, unknown>;
}

/**
 * MCP运行时工具构建结果
 */
export interface AgentMcpRuntimeToolsResult {
  // 最终可注入 ToolLoopAgent 的工具集合
  tools: ToolSet;
  // 释放运行时 MCP 连接的清理函数
  cleanup: () => Promise<void>;
  // 运行时诊断信息（尽力模式下用于可观测性）
  diagnostics: McpRuntimeDiagnostic[];
}

/**
 * 根据 Agent 配置构建 MCP 运行时工具集合（尽力模式）
 * 核心策略：单服务失败不抛错，跳过并继续组装其他服务工具
 */
export async function createAgentMcpRuntimeTools(params: {
  agentId: string;
  agentOwnerUserId: string;
}): Promise<AgentMcpRuntimeToolsResult> {
  const { agentId, agentOwnerUserId } = params;
  // 统一维护诊断信息，返回给上层做日志输出
  const diagnostics: McpRuntimeDiagnostic[] = [];
  // 最终注入给 Agent 的 MCP 工具集合
  const tools: ToolSet = {};
  // 保存所有成功创建的 client，后续统一关闭
  const clients: MCPClient[] = [];

  // 读取 Agent 绑定的 MCP 运行时配置（含 server url/headers/is_enabled）
  const runtimeConfigs = await getAgentMcpRuntimeToolConfigs(agentId, agentOwnerUserId);
  if (runtimeConfigs.length === 0) {
    return {
      tools,
      diagnostics,
      cleanup: async () => {
        // 无client时直接返回，保持接口一致
      },
    };
  }

  // 先按 server 分组，避免同一 server 重复建连
  const serverConfigs = new Map<
    string,
    {
      serverId: string;
      serverName: string;
      serverUrl: string;
      serverHeaders: Record<string, string>;
      serverEnabled: boolean;
      selectedToolNames: Set<string>;
    }
  >();

  for (const config of runtimeConfigs) {
    if (!serverConfigs.has(config.serverId)) {
      serverConfigs.set(config.serverId, {
        serverId: config.serverId,
        serverName: config.serverName,
        serverUrl: config.serverUrl,
        serverHeaders: config.serverHeaders,
        serverEnabled: config.serverEnabled,
        selectedToolNames: new Set<string>(),
      });
    }
    serverConfigs.get(config.serverId)!.selectedToolNames.add(config.toolName);
  }

  // 防止工具名冲突：记录已使用的注入名
  const usedInjectedNames = new Set<string>();

  // 逐个 server 建连并筛选 Agent 需要的工具
  for (const server of serverConfigs.values()) {
    // 若服务被禁用，则直接跳过（尽力模式）
    if (!server.serverEnabled) {
      diagnostics.push({
        level: "warn",
        code: "SERVER_DISABLED",
        message: "MCP服务已禁用，已跳过该服务的工具挂载",
        context: {
          agentId,
          serverId: server.serverId,
          serverName: server.serverName,
        },
      });
      continue;
    }

    let client: MCPClient | null = null;
    let remoteTools: ToolSet = {};
    try {
      // 使用数据库中的 url + headers 建立 MCP 连接
      client = await createMCPClient({
        transport: {
          type: "http",
          url: server.serverUrl,
          headers: Object.keys(server.serverHeaders).length > 0 ? server.serverHeaders : undefined,
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
          agentId,
          serverId: server.serverId,
          serverName: server.serverName,
          serverUrl: server.serverUrl,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      continue;
    }

    try {
      // 拉取该 server 当前可提供的全部工具
      remoteTools = await client.tools();
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "REMOTE_TOOLS_FETCH_FAILED",
        message: "MCP服务工具列表拉取失败，已跳过该服务",
        context: {
          agentId,
          serverId: server.serverId,
          serverName: server.serverName,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      continue;
    }

    // 仅注入 Agent 选中的工具（白名单）
    for (const selectedToolName of server.selectedToolNames) {
      const remoteTool = remoteTools[selectedToolName];
      if (!remoteTool) {
        diagnostics.push({
          level: "warn",
          code: "TOOL_NOT_FOUND_ON_SERVER",
          message: "Agent 选中的 MCP 工具未在远端服务返回中找到，已跳过",
          context: {
            agentId,
            serverId: server.serverId,
            serverName: server.serverName,
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
          agentId,
          serverId: server.serverId,
          serverName: server.serverName,
          sourceToolName: selectedToolName,
          injectedToolName,
        },
      });
    }
  }

  // 统一提供 cleanup，避免上层遗漏 close 导致连接泄漏
  const cleanup = async () => {
    const closeResults = await Promise.allSettled(
      clients.map(async (client) => {
        await client.close();
      })
    );
    // 记录关闭失败但不抛错，避免影响主流程响应
    closeResults.forEach((result, index) => {
      if (result.status === "rejected") {
        diagnostics.push({
          level: "warn",
          code: "SERVER_CONNECT_FAILED",
          message: "MCP客户端关闭失败",
          context: {
            agentId,
            clientIndex: index,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
        });
      }
    });
  };

  return {
    tools,
    cleanup,
    diagnostics,
  };
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
 * 名称清洗：将非字母数字下划线字符转换为下划线
 */
function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}
