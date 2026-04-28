/**
 * MCP 服务模块统一导出
 *
 * 提供 MCP 运行时的完整能力：
 * - 接口抽象（interface.ts）
 * - 运行时实现（runtime.ts）
 */

// ==================== 接口类型导出 ====================

export type {
  // 服务器配置
  McpServerConfig,
  // 工具配置
  McpToolConfig,
  // 运行时配置
  McpRuntimeConfig,
  // 运行时诊断
  McpRuntimeDiagnostic,
  // 运行时结果
  McpRuntimeResult,
  // 运行时接口
  McpRuntimeInterface,
  // 工厂函数类型
  McpRuntimeFactory,
  // 服务器分组配置
  McpServerGroupedConfig,
  // 工具映射结果
  McpToolMapping,
} from "./interface";

// ==================== 运行时实现导出 ====================

export {
  // 运行时类
  McpRuntime,
  // 工厂函数
  createMcpRuntime,
} from "./runtime";