// lib/sandbox/index.ts

/**
 * 沙盒服务模块
 * 提供Agent沙盒工具的客户端实现
 */

// 配置
export { SANDBOX_CONFIG, validateSandboxConfig, isSandboxEnabled } from './config';

// 会话管理
export { SandboxSessionManager, getSandboxManager } from './session-manager';

// 工具
export { getSandboxToolsWithContext, getSandboxTools } from './tools';
// 工具上下文类型
export type { SandboxToolContext } from './tools';

// 工厂函数（推荐使用）
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

// 接口类型
export type {
  SandboxSessionInterface,
  SandboxToolProviderInterface,
  SandboxInstance,
  SandboxCreationConfig,
} from './interface';

// 类型
export type {
  ExecResult,
  SessionState,
  ExecParams,
  ReadFileParams,
  WriteFileParams,
  GatewayResponse,
  SandboxConfig,
} from './types';