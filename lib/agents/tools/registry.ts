/**
 * 工具注册表模块
 * 支持动态注册/查找/冲突处理
 *
 * 设计目标：
 * - 不依赖数据库，纯内存注册
 * - 支持动态扩展工具，不改代码
 * - 提供冲突处理机制
 */

import type { ToolSet } from 'ai';

/**
 * 工具创建结果
 * 包含工具集合和可选的清理函数
 */
export interface ToolCreateResult {
  // 创建的工具集合
  tools: ToolSet;
  // 可选的清理函数，用于释放资源
  cleanup?: () => Promise<void>;
}

/**
 * 工具定义
 * 描述如何创建一个工具或一组工具
 */
export interface ToolDefinition {
  // 工具名称（唯一标识）
  name: string;
  // 工具描述
  description?: string;
  // 工具创建函数
  // 可以是同步或异步，返回 ToolCreateResult
  create: () => ToolCreateResult | Promise<ToolCreateResult>;
  // 工具元数据（可选）
  metadata?: Record<string, unknown>;
}

/**
 * 冲突处理策略
 */
export type ConflictStrategy =
  // 警告并跳过（默认）
  | 'warn'
  // 抛出错误
  | 'error'
  // 覆盖已存在的工具
  | 'overwrite';

/**
 * 注册结果
 */
export interface RegisterResult {
  // 是否注册成功
  success: boolean;
  // 冲突时的已存在工具定义
  existing?: ToolDefinition;
  // 错误信息（仅在 error 策略时）
  error?: string;
}

/**
 * 工具注册表类
 * 管理工具的注册、查找和冲突处理
 */
export class ToolRegistry {
  // 工具存储映射
  private tools: Map<string, ToolDefinition> = new Map();

  // 默认冲突处理策略
  private defaultStrategy: ConflictStrategy = 'warn';

  /**
   * 注册工具
   * @param definition - 工具定义
   * @param strategy - 可选的冲突处理策略，覆盖默认策略
   * @returns 注册结果
   */
  register(
    definition: ToolDefinition,
    strategy?: ConflictStrategy,
  ): RegisterResult {
    const { name } = definition;
    const conflictStrategy = strategy ?? this.defaultStrategy;

    // 检查是否存在冲突
    if (this.tools.has(name)) {
      const existing = this.tools.get(name)!;

      switch (conflictStrategy) {
        case 'error':
          // 抛出错误，阻止注册
          return {
            success: false,
            existing,
            error: `工具注册冲突: 工具 "${name}" 已存在`,
          };

        case 'overwrite':
          // 覆盖已存在的工具
          console.warn(`[ToolRegistry] 工具 "${name}" 已被覆盖`);
          this.tools.set(name, definition);
          return { success: true, existing };

        case 'warn':
        default:
          // 警告并跳过
          console.warn(`[ToolRegistry] 工具 "${name}" 已存在，跳过注册`);
          return { success: false, existing };
      }
    }

    // 无冲突，正常注册
    this.tools.set(name, definition);
    return { success: true };
  }

  /**
   * 批量注册工具
   * @param definitions - 工具定义数组
   * @param strategy - 可选的冲突处理策略
   * @returns 每个工具的注册结果
   */
  registerAll(
    definitions: ToolDefinition[],
    strategy?: ConflictStrategy,
  ): Map<string, RegisterResult> {
    const results = new Map<string, RegisterResult>();

    for (const definition of definitions) {
      results.set(definition.name, this.register(definition, strategy));
    }

    return results;
  }

  /**
   * 查找工具
   * @param name - 工具名称
   * @returns 工具定义或 undefined
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   * @param name - 工具名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有注册的工具
   * @returns 工具定义列表
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有工具名称
   * @returns 工具名称列表
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 注销工具
   * @param name - 工具名称
   * @returns 是否注销成功
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * 获取注册工具数量
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * 设置默认冲突处理策略
   */
  setDefaultStrategy(strategy: ConflictStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * 创建工具实例
   * @param name - 工具名称
   * @returns 工具创建结果，如果工具不存在则返回 null
   */
  async create(name: string): Promise<ToolCreateResult | null> {
    const definition = this.tools.get(name);
    if (!definition) {
      return null;
    }
    return definition.create();
  }

  /**
   * 批量创建工具实例
   * @param names - 工具名称列表
   * @returns 合并后的工具集合和清理函数
   */
  async createAll(names: string[]): Promise<ToolCreateResult> {
    const tools: ToolSet = {};
    const cleanupCallbacks: Array<() => Promise<void>> = [];

    for (const name of names) {
      const result = await this.create(name);
      if (result) {
        // 合并工具集合
        Object.assign(tools, result.tools);
        // 收集清理函数
        if (result.cleanup) {
          cleanupCallbacks.push(result.cleanup);
        }
      }
    }

    return {
      tools,
      cleanup: async () => {
        for (const cb of cleanupCallbacks) {
          try {
            await cb();
          } catch (e) {
            console.error('[ToolRegistry] 工具清理失败:', e);
          }
        }
      },
    };
  }
}

// ============================================
// 全局注册表实例和便捷函数
// ============================================

/**
 * 全局工具注册表实例
 */
const globalRegistry = new ToolRegistry();

/**
 * 注册工具到全局注册表
 * @param definition - 工具定义
 * @param strategy - 可选的冲突处理策略
 * @returns 注册结果
 */
export function registerTool(
  definition: ToolDefinition,
  strategy?: ConflictStrategy,
): RegisterResult {
  return globalRegistry.register(definition, strategy);
}

/**
 * 从全局注册表查找工具
 * @param name - 工具名称
 * @returns 工具定义或 undefined
 */
export function getTool(name: string): ToolDefinition | undefined {
  return globalRegistry.get(name);
}

/**
 * 获取全局注册表中所有工具
 * @returns 工具定义列表
 */
export function getAllTools(): ToolDefinition[] {
  return globalRegistry.getAll();
}

/**
 * 检查工具是否存在于全局注册表
 * @param name - 工具名称
 * @returns 是否存在
 */
export function hasTool(name: string): boolean {
  return globalRegistry.has(name);
}

/**
 * 注销全局注册表中的工具
 * @param name - 工具名称
 * @returns 是否注销成功
 */
export function unregisterTool(name: string): boolean {
  return globalRegistry.unregister(name);
}

/**
 * 从全局注册表创建工具实例
 * @param names - 工具名称列表
 * @returns 合并后的工具集合和清理函数
 */
export async function createTools(names: string[]): Promise<ToolCreateResult> {
  return globalRegistry.createAll(names);
}

/**
 * 获取全局注册表实例
 * 用于高级操作
 */
export function getGlobalRegistry(): ToolRegistry {
  return globalRegistry;
}

/**
 * 清空全局注册表
 * 主要用于测试场景
 */
export function clearGlobalRegistry(): void {
  globalRegistry.clear();
}