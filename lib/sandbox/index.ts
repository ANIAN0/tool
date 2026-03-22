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
export { bashTool, readFileTool, writeFileTool, getSandboxTools } from './tools';

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