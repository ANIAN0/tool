// lib/sandbox/config.ts

import type { SandboxConfig } from './types';

/**
 * 沙盒服务配置
 * 从环境变量读取，统一配置源
 */
export const SANDBOX_CONFIG: SandboxConfig = {
  // Gateway服务地址
  gatewayUrl: process.env.SANDBOX_GATEWAY_URL || 'http://localhost:8080',
  // API密钥
  apiKey: process.env.SANDBOX_API_KEY || '',
  // 闲置超时时间（30分钟）
  idleTimeoutMs: parseInt(process.env.SANDBOX_IDLE_TIMEOUT_MS || '1800000'),
  // 请求超时时间（60秒）
  requestTimeoutMs: parseInt(process.env.SANDBOX_REQUEST_TIMEOUT_MS || '60000'),
};

/**
 * 验证配置是否完整
 */
export function validateSandboxConfig(): boolean {
  if (!SANDBOX_CONFIG.gatewayUrl) {
    console.warn('[Sandbox] SANDBOX_GATEWAY_URL 未配置');
    return false;
  }
  if (!SANDBOX_CONFIG.apiKey) {
    console.warn('[Sandbox] SANDBOX_API_KEY 未配置');
    return false;
  }
  return true;
}

/**
 * 检查沙盒功能是否启用
 */
export function isSandboxEnabled(): boolean {
  return process.env.SANDBOX_ENABLED === 'true' && validateSandboxConfig();
}