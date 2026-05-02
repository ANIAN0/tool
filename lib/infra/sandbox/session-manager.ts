// lib/sandbox/session-manager.ts

import { SANDBOX_CONFIG, isSandboxEnabled } from './config';
import type { ExecResult, ExecParams, ReadFileParams, SkillMountParams, WriteFileParams } from './types';

/**
 * 沙盒会话管理器
 * 负责与Gateway通信，管理沙盒会话
 */
export class SandboxSessionManager {
  private gatewayUrl: string;
  private apiKey: string;
  private requestTimeout: number;

  constructor() {
    // 从配置中获取Gateway地址
    this.gatewayUrl = SANDBOX_CONFIG.gatewayUrl;
    // 从配置中获取API密钥
    this.apiKey = SANDBOX_CONFIG.apiKey;
    // 从配置中获取请求超时时间
    this.requestTimeout = SANDBOX_CONFIG.requestTimeoutMs;
  }

  /**
   * 发送请求到Gateway
   * @param method HTTP方法
   * @param path 请求路径
   * @param body 请求体
   * @returns 响应数据
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    // 拼接完整URL
    const url = `${this.gatewayUrl}${path}`;

    // 发送HTTP请求
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // 使用 Bearer 认证格式，与服务端 auth.py 保持一致
        'Authorization': `Bearer ${this.apiKey}`,
      },
      // 如果有请求体，序列化为JSON
      body: body ? JSON.stringify(body) : undefined,
      // 设置请求超时
      signal: AbortSignal.timeout(this.requestTimeout),
    });

    // 检查响应状态
    if (!response.ok) {
      // 尝试解析错误信息
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    // 返回解析后的JSON数据
    return response.json();
  }

  /**
   * 执行命令（自动激活会话）
   * @param params 执行参数
   * @returns 执行结果
   */
  async exec(params: ExecParams): Promise<ExecResult> {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      throw new Error('沙盒服务未启用');
    }

    // 发送执行请求到Gateway
    const result = await this.request<ExecResult>(
      'POST',
      `/api/v1/sessions/${params.sessionId}/exec`,
      {
        userId: params.userId,
        code: params.code,
        language: params.language,
      }
    );

    return result;
  }

  /**
   * 读取文件
   * @param params 读取参数
   * @returns 文件内容
   */
  async readFile(params: ReadFileParams): Promise<string> {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      throw new Error('沙盒服务未启用');
    }

    // 发送读取请求到Gateway
    const result = await this.request<{ success: boolean; content: string }>(
      'POST',
      `/api/v1/sessions/${params.sessionId}/read`,
      {
        userId: params.userId,
        path: params.relativePath,
      }
    );

    return result.content;
  }

  /**
   * 写入文件
   * @param params 写入参数
   */
  async writeFile(params: WriteFileParams): Promise<void> {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      throw new Error('沙盒服务未启用');
    }

    // 发送写入请求到Gateway
    await this.request<{ success: boolean }>(
      'POST',
      `/api/v1/sessions/${params.sessionId}/write`,
      {
        userId: params.userId,
        path: params.relativePath,
        content: params.content,
      }
    );
  }

  /**
   * 注册会话级 Skill 只读挂载
   * @param params Skill挂载参数
   */
  async mountSkills(params: SkillMountParams): Promise<string[]> {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      throw new Error('沙盒服务未启用');
    }

    // 只向服务端提交 Skill 源文件，服务端负责缓存并通过 nsjail 只读挂载
    const result = await this.request<{ success: boolean; mountedSkills: string[] }>(
      'POST',
      `/api/v1/sessions/${params.sessionId}/skills`,
      {
        userId: params.userId,
        skills: params.skills,
      }
    );

    return result.mountedSkills;
  }

  /**
   * 发送心跳，保持会话活跃
   * @param sessionId 会话ID
   */
  async heartbeat(sessionId: string): Promise<void> {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      return;
    }

    // 发送心跳请求
    await this.request('POST', `/api/v1/sessions/${sessionId}/heartbeat`);
  }

  /**
   * 查询会话状态
   * @param sessionId 会话ID
   * @returns 会话状态信息
   */
  async getStatus(sessionId: string): Promise<{ status: string; lastActivity: number }> {
    // 发送状态查询请求
    const result = await this.request<{ status: string; lastActivity: number }>(
      'GET',
      `/api/v1/sessions/${sessionId}/status`
    );
    return result;
  }
}

// 全局单例实例
let instance: SandboxSessionManager | null = null;

/**
 * 获取SandboxSessionManager单例
 * @returns SandboxSessionManager实例
 */
export function getSandboxManager(): SandboxSessionManager {
  // 如果实例不存在，创建新实例
  if (!instance) {
    instance = new SandboxSessionManager();
  }
  return instance;
}
