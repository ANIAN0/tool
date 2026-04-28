/**
 * 工具模块统一导出
 */

export type {
  ToolDefinition,
  ToolCreateResult,
  ConflictStrategy,
  RegisterResult,
} from './registry';

export type {
  ToolType,
  ToolsCreateResult,
  ToolCreator,
  ToolRegistryEntry,
  ToolConflictStrategy,
  ToolRegisterOptions,
  ToolCreateOptions,
  BatchToolsCreateResult,
} from './types';

export type { ToolService } from './service';

export {
  ToolRegistry,
  registerTool,
  getTool,
  getAllTools,
  hasTool,
  unregisterTool,
  createTools,
  getGlobalRegistry,
  clearGlobalRegistry,
} from './registry';

// 工具初始化模块
export {
  initTools,
  initAllTools,
  registerTavilyTool,
  registerSandboxTool,
  registerMcpTool,
} from './init';

// 系统工具
export {
  SYSTEM_TOOL_IDS,
  getDefaultSystemTools,
  validateSystemToolIds,
  parseSystemTools,
  serializeSystemTools,
  isSystemToolId,
  SYSTEM_TOOLS_META,
  type SystemToolId,
  type SystemToolMeta,
} from './system';