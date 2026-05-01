// lib/sandbox/factory.ts

/**
 * 沙盒工厂函数
 * 提供统一的工厂接口创建沙盒实例和工具提供者
 * 支持工厂模式，便于mock测试和多种实现切换
 */

import type { ToolSet } from 'ai';
import {
  type SandboxSessionInterface,
  type SandboxToolProviderInterface,
  type SandboxInstance,
  type SandboxCreationConfig,
} from './interface';
import { getSandboxManager } from './session-manager';
import { createSandboxTools } from './tools';
import { isSandboxEnabled } from './config';

/**
 * 现有实现的工具提供者适配器
 * 将现有的 createSandboxTools 函数适配到接口
 */
class DefaultToolProvider implements SandboxToolProviderInterface {
  /**
   * 获取沙盒工具集（无参数版本）
   * execute 函数通过 experimental_context 获取沙盒实例
   * @returns AI SDK ToolSet 对象
   */
  getTools(): ToolSet {
    // 调用新的无参数版本获取工具
    return createSandboxTools();
  }

  /**
   * 检查沙盒是否可用
   * @returns 是否可用
   */
  isAvailable(): boolean {
    // 检查配置是否启用
    return isSandboxEnabled();
  }
}

/**
 * 默认沙盒会话适配器
 * 将现有的 SandboxSessionManager 适配到接口
 * 注意：SandboxSessionManager 已经实现了所有接口方法，
 * 这里使用包装类是为了明确类型关系和后续可替换性
 */
class DefaultSandboxSession implements SandboxSessionInterface {
  // 内部使用的真实会话管理器
  private manager: ReturnType<typeof getSandboxManager>;

  constructor() {
    // 获取现有的单例管理器
    this.manager = getSandboxManager();
  }

  /**
   * 执行代码命令
   * @param params 执行参数
   * @returns 执行结果
   */
  async exec(params: import('./types').ExecParams): Promise<import('./types').ExecResult> {
    // 调用底层管理器执行
    return this.manager.exec(params);
  }

  /**
   * 读取沙盒工作空间中的文件
   * @param params 读取参数
   * @returns 文件内容
   */
  async readFile(params: import('./types').ReadFileParams): Promise<string> {
    // 调用底层管理器读取
    return this.manager.readFile(params);
  }

  /**
   * 写入文件到沙盒工作空间
   * @param params 写入参数
   */
  async writeFile(params: import('./types').WriteFileParams): Promise<void> {
    // 调用底层管理器写入
    return this.manager.writeFile(params);
  }

  /**
   * 发送心跳，保持会话活跃
   * @param sessionId 会话ID
   */
  async heartbeat(sessionId: string): Promise<void> {
    // 调用底层管理器发送心跳
    return this.manager.heartbeat(sessionId);
  }

  /**
   * 查询会话状态
   * @param sessionId 会话ID
   * @returns 会话状态信息
   */
  async getStatus(sessionId: string): Promise<{ status: string; lastActivity: number }> {
    // 调用底层管理器获取状态
    return this.manager.getStatus(sessionId);
  }
}

// ==================== 工厂函数 ====================

/**
 * 用于测试的mock实例注入
 * 允许测试时替换默认实现
 */
let mockSession: SandboxSessionInterface | null = null;
let mockToolProvider: SandboxToolProviderInterface | null = null;

/**
 * 设置mock沙盒会话（用于测试）
 * @param session mock会话实例，null表示清除mock
 */
export function setMockSandboxSession(session: SandboxSessionInterface | null): void {
  mockSession = session;
}

/**
 * 设置mock工具提供者（用于测试）
 * @param provider mock工具提供者实例，null表示清除mock
 */
export function setMockToolProvider(provider: SandboxToolProviderInterface | null): void {
  mockToolProvider = provider;
}

/**
 * 清除所有mock设置（用于测试后清理）
 */
export function clearAllMocks(): void {
  mockSession = null;
  mockToolProvider = null;
}

/**
 * 创建沙盒会话实例
 * 如果设置了mock，则返回mock实例；否则返回默认实现
 *
 * @param config 可选的创建配置（当前未使用，为后续扩展预留）
 * @returns 沙盒会话实例
 */
export function createSandboxSession(config?: SandboxCreationConfig): SandboxSessionInterface {
  // 如果设置了mock，返回mock实例
  if (mockSession) {
    return mockSession;
  }

  // 返回默认实现
  return new DefaultSandboxSession();
}

/**
 * 创建沙盒工具提供者
 * 如果设置了mock，则返回mock实例；否则返回默认实现
 *
 * @param session 沙盒会话实例（当前未使用，为后续扩展预留）
 * @param config 可选的创建配置（当前未使用，为后续扩展预留）
 * @returns 工具提供者实例
 */
export function createSandboxToolProvider(
  session?: SandboxSessionInterface,
  config?: SandboxCreationConfig
): SandboxToolProviderInterface {
  // 如果设置了mock，返回mock实例
  if (mockToolProvider) {
    return mockToolProvider;
  }

  // 返回默认实现
  return new DefaultToolProvider();
}

/**
 * 创建完整沙盒实例（会话 + 工具提供者）
 * 这是主要的工厂函数，返回完整的沙盒功能组合
 *
 * @param config 可选的创建配置
 * @returns 包含会话和工具提供者的完整实例
 */
export function createSandboxInstance(config?: SandboxCreationConfig): SandboxInstance {
  // 创建会话实例
  const session = createSandboxSession(config);

  // 创建工具提供者（传入会话实例）
  const toolProvider = createSandboxToolProvider(session, config);

  // 返回完整实例
  return {
    session,
    toolProvider,
  };
}

// 导出工厂函数类型别名，便于外部使用
export type { SandboxInstanceFactory, SandboxToolProviderFactory, SandboxSessionFactory } from './interface';