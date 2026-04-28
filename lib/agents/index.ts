/**
 * Agent模块统一导出
 *
 * 注意：Agent运行时创建由 lib/agent-chat/runtime.ts 负责
 * 本模块主要导出模板相关功能
 */

// 导出模板相关（从 templates.ts）
export {
  AGENT_TEMPLATES,
  getTemplateById,
  getTemplateList,
  validateTemplateConfig,
  getTemplateDefaultConfig,
  type AgentTemplate,
  type TemplateConfigField,
} from './templates';

// 导出 MCP 运行时工具构建
export {
  createAgentMcpRuntimeTools,
  type AgentMcpRuntimeConfig,
  type AgentMcpRuntimeToolsResult,
} from './mcp-runtime';

// 导出工具集合合并
export {
  mergeAgentToolSets,
  type MergeToolSetsParams,
} from './toolset-merge';