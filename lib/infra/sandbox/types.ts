// lib/sandbox/types.ts

/**
 * 沙盒服务类型定义
 */

// 执行结果
export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  execTimeMs?: number;
}

// 会话状态
export interface SessionState {
  sessionId: string;
  userId: string;
  status: 'active' | 'idle';
  lastActivity: number;
  vmId?: string;
}

// 执行参数
export interface ExecParams {
  sessionId: string;
  userId: string;
  code: string;
  language: 'bash' | 'python' | 'node';
}

// 文件读取参数
export interface ReadFileParams {
  sessionId: string;
  userId: string;
  relativePath: string;
}

// 文件写入参数
export interface WriteFileParams {
  sessionId: string;
  userId: string;
  relativePath: string;
  content: string;
}

// Gateway API响应
export interface GatewayResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// 沙盒配置
export interface SandboxConfig {
  gatewayUrl: string;
  apiKey: string;
  idleTimeoutMs: number;
  requestTimeoutMs: number;
}