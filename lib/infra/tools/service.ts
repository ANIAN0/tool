/**
 * 工具服务接口
 * 提供统一的工具注册和创建能力
 */

import type { ToolSet } from 'ai';
import type {
  ToolDefinition,
  ToolCreateResult,
  ConflictStrategy,
  RegisterResult,
} from './registry';

/**
 * 工具服务接口
 */
export interface ToolService {
  /**
   * 注册工具
   * @param definition - 工具定义
   * @param strategy - 冲突处理策略
   * @returns 注册结果
   */
  register(definition: ToolDefinition, strategy?: ConflictStrategy): RegisterResult;

  /**
   * 批量注册
   * @param definitions - 工具定义数组
   * @param strategy - 冲突处理策略
   * @returns 注册结果映射
   */
  registerAll(
    definitions: ToolDefinition[],
    strategy?: ConflictStrategy
  ): Map<string, RegisterResult>;

  /**
   * 创建单个工具实例
   * @param name - 工具名称
   * @returns 工具创建结果，不存在则返回 null
   */
  create(name: string): Promise<ToolCreateResult | null>;

  /**
   * 批量创建工具实例
   * @param names - 工具名称数组
   * @return 合并后的工具集合和清理函数
   */
  createAll(names: string[]): Promise<ToolCreateResult>;

  /**
   * 查找工具
   * @param name - 工具名称
   * @returns 工具定义或 undefined
   */
  get(name: string): ToolDefinition | undefined;

  /**
   * 获取所有已注册的工具
   * @returns 工具定义列表
   */
  getAll(): ToolDefinition[];

  /**
   * 检查工具是否存在
   * @param name - 工具名称
   * @returns 是否存在
   */
  has(name: string): boolean;
}