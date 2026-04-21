/**
 * 工具模块类型定义
 * 为工具注册表和工具创建函数提供类型支持
 */

import type { ToolSet } from 'ai';

/**
 * 工具类型枚举
 * 扩展时通过注册表添加，不修改此类型
 */
export type ToolType = 'tavily' | 'mcp';

/**
 * 工具创建结果
 * 包含工具集合和清理函数
 */
export interface ToolsCreateResult {
  // 创建的工具集合
  tools: ToolSet;
  // 清理函数，用于释放资源（如关闭MCP连接）
  cleanup: () => Promise<void>;
}

/**
 * 工具创建器函数签名
 * 根据配置创建工具集合和清理函数
 */
export type ToolCreator = (config?: Record<string, unknown>) => Promise<ToolsCreateResult>;

/**
 * 工具定义
 * 注册到工具注册表的完整信息
 */
export interface ToolDefinition {
  // 工具唯一标识，用于查找和引用
  name: string;
  // 工具类型分类
  type: ToolType;
  // 工具创建器函数
  creator: ToolCreator;
  // 工具描述，用于展示和文档
  description?: string;
  // 工具依赖的其他模块（如sandbox、mcp）
  dependencies?: string[];
}

/**
 * 工具注册表条目
 * 注册表中存储的完整条目信息
 */
export interface ToolRegistryEntry {
  // 工具定义信息
  definition: ToolDefinition;
  // 注册时间（用于追踪注册顺序）
  registeredAt: Date;
  // 注册来源（用于调试和追踪）
  registeredBy?: string;
}

/**
 * 工具冲突处理策略
 * 当注册同名工具时的处理方式
 */
export type ToolConflictStrategy =
  // 抛出错误，拒绝注册
  | 'error'
  // 跳过新工具，保留已注册的
  | 'skip'
  // 覆盖已注册的工具
  | 'override'
  // 记录警告，但允许注册（可能导致运行时冲突）
  | 'warn';

/**
 * 工具注册选项
 * 控制注册行为的配置
 */
export interface ToolRegisterOptions {
  // 冲突处理策略（默认为 'error')
  conflictStrategy?: ToolConflictStrategy;
  // 注册来源标识
  registeredBy?: string;
}

/**
 * 工具创建选项
 * 创建工具时传入的配置
 */
export interface ToolCreateOptions {
  // 工具名称
  name: string;
  // 工具配置参数
  config?: Record<string, unknown>;
}

/**
 * 批量工具创建结果
 * 创建多个工具后的合并结果
 */
export interface BatchToolsCreateResult {
  // 合并后的工具集合
  tools: ToolSet;
  // 合并后的清理函数
  cleanup: () => Promise<void>;
  // 创建失败的工具名称列表
  failed?: string[];
}