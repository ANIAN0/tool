// lib/sandbox/interface.ts

/**
 * 沙盒接口抽象定义
 * 用于支持多种沙盒实现，便于 mock 测试和工厂模式创建
 */

import type { ToolSet } from 'ai';
import type {
  ExecResult,
  ExecParams,
  ReadFileParams,
  WriteFileParams,
  SessionState,
  SandboxConfig,
} from './types';

/**
 * 沙盒会话接口
 * 定义沙盒操作的核心方法，支持多种实现（真实沙盒、mock 沙盒等）
 */
export interface SandboxSessionInterface {
  /**
   * 执行代码命令
   * @param params 执行参数（会话ID、用户ID、代码、语言）
   * @returns 执行结果（stdout、stderr、exitCode等）
   */
  exec(params: ExecParams): Promise<ExecResult>;

  /**
   * 读取沙盒工作空间中的文件
   * @param params 读取参数（会话ID、用户ID、相对路径）
   * @returns 文件内容
   */
  readFile(params: ReadFileParams): Promise<string>;

  /**
   * 写入文件到沙盒工作空间
   * @param params 写入参数（会话ID、用户ID、相对路径、内容）
   */
  writeFile(params: WriteFileParams): Promise<void>;

  /**
   * 发送心跳，保持会话活跃
   * @param sessionId 会话ID
   */
  heartbeat(sessionId: string): Promise<void>;

  /**
   * 查询会话状态
   * @param sessionId 会话ID
   * @returns 会话状态信息
   */
  getStatus(sessionId: string): Promise<{ status: string; lastActivity: number }>;
}

/**
 * 工具执行上下文
 * 包含执行沙盒工具所需的会话信息
 */
export interface SandboxToolContext {
  conversationId: string;
  userId: string;
}

/**
 * 沙盒工具提供者接口
 * 定义创建沙盒工具的方法，便于不同实现提供不同的工具集
 */
export interface SandboxToolProviderInterface {
  /**
   * 获取沙盒工具集（带上下文绑定）
   * @param context 工具执行上下文
   * @returns AI SDK ToolSet 对象
   */
  getToolsWithContext(context: SandboxToolContext): ToolSet;

  /**
   * 检查沙盒是否可用
   * @returns 是否可用
   */
  isAvailable(): boolean;
}

/**
 * 沙盒配置接口
 * 用于创建沙盒实例的配置参数
 */
export interface SandboxCreationConfig {
  /** 沙盒配置参数 */
  config: SandboxConfig;
  /** 是否启用沙盒 */
  enabled: boolean;
}

/**
 * 沙盒工厂函数类型
 * 用于创建 SandboxSessionInterface 实例
 * 支持工厂模式，便于根据配置创建不同实现
 */
export type SandboxSessionFactory = (
  config?: SandboxCreationConfig
) => SandboxSessionInterface;

/**
 * 工具提供者工厂函数类型
 * 用于创建 SandboxToolProviderInterface 实例
 */
export type SandboxToolProviderFactory = (
  session: SandboxSessionInterface,
  config?: SandboxCreationConfig
) => SandboxToolProviderInterface;

/**
 * 完整沙盒实例
 * 包含会话和工具提供者
 */
export interface SandboxInstance {
  /** 沙盒会话实例 */
  session: SandboxSessionInterface;
  /** 工具提供者实例 */
  toolProvider: SandboxToolProviderInterface;
}

/**
 * 沙盒实例工厂函数类型
 * 创建完整的沙盒实例（会话 + 工具提供者）
 */
export type SandboxInstanceFactory = (
  config?: SandboxCreationConfig
) => SandboxInstance;