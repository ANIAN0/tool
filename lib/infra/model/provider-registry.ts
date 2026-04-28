/**
 * AI Provider 注册表
 * 管理模型提供商的注册和查找
 */

import type { LanguageModel } from 'ai';

/**
 * 模型提供商类型
 */
export type ProviderType = 
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'vercel'
  | 'custom';

/**
 * Provider 配置
 */
export interface ProviderConfig {
  /** 提供商类型 */
  type: ProviderType;
  /** API 密钥 */
  apiKey: string;
  /** 自定义基础 URL（可选） */
  baseURL?: string;
  /** 提供商特定配置 */
  options?: Record<string, unknown>;
}

/**
 * Provider 注册信息
 */
export interface ProviderRegistration {
  /** 提供商 ID */
  id: string;
  /** 提供商类型 */
  type: ProviderType;
  /** 配置 */
  config: ProviderConfig;
  /** 创建模型实例的工厂函数 */
  createModel: (modelId: string) => LanguageModel;
}

/**
 * Provider 注册表（单例）
 */
class ProviderRegistry {
  private providers = new Map<string, ProviderRegistration>();

  /**
   * 注册 Provider
   * @param id - Provider ID
   * @param registration - 注册信息
   */
  register(id: string, registration: ProviderRegistration): void {
    this.providers.set(id, registration);
    console.log(`Provider 已注册：${id} (${registration.type})`);
  }

  /**
   * 获取 Provider
   * @param id - Provider ID
   * @returns Provider 注册信息（如果存在）
   */
  get(id: string): ProviderRegistration | undefined {
    return this.providers.get(id);
  }

  /**
   * 检查 Provider 是否存在
   * @param id - Provider ID
   * @returns 是否存在
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * 获取所有已注册的 Provider
   * @returns Provider 列表
   */
  getAll(): ProviderRegistration[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取所有 Provider ID
   * @returns Provider ID 列表
   */
  getIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 注销 Provider
   * @param id - Provider ID
   */
  unregister(id: string): void {
    this.providers.delete(id);
    console.log(`Provider 已注销：${id}`);
  }

  /**
   * 清空注册表（用于测试）
   */
  clear(): void {
    this.providers.clear();
  }
}

// 导出单例实例
export const providerRegistry = new ProviderRegistry();

/**
 * 注册 Provider 的便捷函数
 */
export function registerProvider(
  id: string,
  type: ProviderType,
  config: ProviderConfig,
  createModel: (modelId: string) => LanguageModel
): void {
  providerRegistry.register(id, {
    id,
    type,
    config,
    createModel,
  });
}

/**
 * 获取 Provider
 */
export function getProvider(id: string): ProviderRegistration | undefined {
  return providerRegistry.get(id);
}

/**
 * 检查 Provider 是否存在
 */
export function hasProvider(id: string): boolean {
  return providerRegistry.has(id);
}