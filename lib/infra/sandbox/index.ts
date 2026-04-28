/**
 * 沙盒公共设施模块统一导出
 *
 * 提供沙盒环境的核心能力：
 * - 配置管理
 * - 接口抽象
 * - 会话管理
 * - 工具创建
 * - Skill 加载
 * - 路径验证
 */

// ==================== 配置导出 ====================

export { SANDBOX_CONFIG, validateSandboxConfig, isSandboxEnabled } from './config';

// ==================== 会话管理导出 ====================

export { SandboxSessionManager, getSandboxManager } from './session-manager';

// ==================== 工具导出 ====================

export { getSandboxToolsWithContext, getSandboxTools } from './tools';
export type { SandboxToolContext } from './tools';

// ==================== 工厂函数导出 ====================

export {
  createSandboxInstance,
  createSandboxSession,
  createSandboxToolProvider,
  setMockSandboxSession,
  setMockToolProvider,
  clearAllMocks,
} from './factory';
export type {
  SandboxInstanceFactory,
  SandboxToolProviderFactory,
  SandboxSessionFactory,
} from './factory';

// ==================== 接口类型导出 ====================

export type {
  SandboxSessionInterface,
  SandboxToolProviderInterface,
  SandboxInstance,
  SandboxCreationConfig,
} from './interface';

// ==================== 数据类型导出 ====================

export type {
  ExecResult,
  SessionState,
  ExecParams,
  ReadFileParams,
  WriteFileParams,
  GatewayResponse,
  SandboxConfig,
} from './types';

// ==================== Skill 加载导出 ====================

export { loadSkillsToSandbox } from './skill-loader';

// ==================== 路径验证导出 ====================

export { validateSandboxPath, hashUserId, ValidationError } from './path-validator';