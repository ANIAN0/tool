/**
 * Tools 模块统一导出
 */

// 工具类型定义（来自 registry.ts）
export type {
  ToolDefinition,
  ToolCreateResult,
  ConflictStrategy,
  RegisterResult,
} from './registry';

// 工具类型定义（来自 types.ts）
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

// 工具注册表
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
