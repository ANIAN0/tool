/**
 * MCP 接口抽象
 *
 * 本模块定义 MCP 运行时的核心接口，支持：
 * - 接口抽象 + 依赖注入
 * - 配置由调用方传入，不直接查数据库
 * - 与现有 mcp-runtime 实现兼容
 */

import type { ToolSet } from "ai";

// ==================== MCP 服务器配置 ====================

/**
 * MCP 服务器配置
 * 定义单个 MCP 服务器的连接参数
 */
export interface McpServerConfig {
  // 服务唯一标识（用于日志和诊断）
  id: string;
  // 服务名称（人类可读，用于日志）
  name: string;
  // 服务连接 URL
  url: string;
  // 自定义请求头（可选，用于认证等）
  headers?: Record<string, string>;
  // 服务启用状态（false 时运行时应跳过）
  enabled: boolean;
}

// ==================== MCP 工具配置 ====================

/**
 * MCP 工具配置
 * 定义 Agent 需要从服务器获取的工具
 */
export interface McpToolConfig {
  // 所属服务器 ID
  serverId: string;
  // 工具名称（远端工具白名单）
  toolName: string;
}

// ==================== MCP 运行时配置 ====================

/**
 * MCP 运行时配置
 * 由调用方传入，不直接查数据库
 */
export interface McpRuntimeConfig {
  // 所有 MCP 服务器配置（按 serverId 唯一）
  servers: McpServerConfig[];
  // Agent 选中的工具配置（白名单）
  tools: McpToolConfig[];
}

// ==================== MCP 运行时诊断 ====================

/**
 * MCP 运行时诊断信息
 * 用于记录"跳过服务""工具不存在"等降级细节，便于排查
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
  // 扩展上下文（包含 serverId、toolName 等）
  context?: Record<string, unknown>;
}

// ==================== MCP 运行时结果 ====================

/**
 * MCP 运行时构建结果
 * 包含工具集合、清理函数和诊断信息
 */
export interface McpRuntimeResult {
  // 最终可注入 Agent 的工具集合
  tools: ToolSet;
  // 释放运行时 MCP 连接的清理函数
  cleanup: () => Promise<void>;
  // 运行时诊断信息（尽力模式下用于可观测性）
  diagnostics: McpRuntimeDiagnostic[];
}

// ==================== MCP 运行时接口 ====================

/**
 * MCP 运行时接口
 * 定义 MCP 运行时的核心能力
 */
export interface McpRuntimeInterface {
  // 获取当前工具集合
  getTools(): ToolSet;
  // 获取诊断信息
  getDiagnostics(): McpRuntimeDiagnostic[];
  // 清理运行时资源（关闭连接）
  cleanup(): Promise<void>;
}

// ==================== MCP 运行时工厂 ====================

/**
 * MCP 运行时工厂函数类型
 * 根据配置创建 MCP 运行时实例
 */
export type McpRuntimeFactory = (config: McpRuntimeConfig) => Promise<McpRuntimeResult>;

// ==================== 辅助类型 ====================

/**
 * MCP 服务器分组配置
 * 用于运行时内部按服务器分组处理工具
 */
export interface McpServerGroupedConfig {
  // 服务器配置
  server: McpServerConfig;
  // 该服务器下 Agent 选中的工具名集合
  selectedToolNames: Set<string>;
}

/**
 * MCP 工具映射结果
 * 记录工具从远端到注入的映射关系
 */
export interface McpToolMapping {
  // 源工具名（远端服务返回）
  sourceToolName: string;
  // 注入工具名（用于 Agent）
  injectedToolName: string;
  // 所属服务器 ID
  serverId: string;
}