/**
 * Skill 工具模块类型定义
 * 为 Skill 执行提供类型支持
 */

import type { SkillContext, SkillResult } from './core-types';

/**
 * Skill 工具输入参数
 */
export interface SkillToolInput {
  // Skill ID（唯一标识）
  skillId: string;
  // JSON 字符串形式的输入参数
  input: string;
}

/**
 * Skill 工具执行上下文（扩展版）
 * 包含完整的执行环境信息
 */
export interface SkillExecutionContext extends SkillContext {
  // 沙盒会话 ID（可选）
  sessionId?: string;
  // 额外的元数据（可选）
  metadata?: Record<string, unknown>;
}

/**
 * Skill 执行结果（工具返回格式）
 * 统一的工具返回格式
 */
export interface SkillToolResult {
  // 执行是否成功
  success: boolean;
  // 执行结果数据（成功时）
  data?: unknown;
  // 错误信息（失败时）
  error?: string;
  // 错误类型（失败时）
  errorType?: SkillErrorType;
  // 执行日志
  logs?: string[];
}

/**
 * Skill 错误类型枚举
 */
export type SkillErrorType =
  // Skill 未找到
  | 'SKILL_NOT_FOUND'
  // Skill 执行错误
  | 'SKILL_EXECUTE_ERROR'
  // 输入参数无效
  | 'INVALID_INPUT'
  // Skill 未注册
  | 'SKILL_NOT_REGISTERED'
  // 上下文缺失
  | 'CONTEXT_MISSING';

/**
 * Skill 工具定义接口
 * 用于注册到 ToolRegistry
 */
export interface SkillToolDefinition {
  // Skill ID
  skillId: string;
  // Skill 名称
  skillName: string;
  // Skill 描述
  skillDescription: string;
  // 输入 Schema（JSON Schema 格式）
  inputSchema: Record<string, unknown>;
}

/**
 * Skill 加载结果
 */
export interface SkillLoadResult {
  // 加载是否成功
  success: boolean;
  // 加载成功的 Skill ID 列表
  loadedSkillIds: string[];
  // 加载失败的 Skill 信息
  failedSkills: Array<{ skillId: string; error: string }>;
  // 生成的工具定义列表
  toolDefinitions: SkillToolDefinition[];
}