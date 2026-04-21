/**
 * 模型解析器
 * 根据模型 ID 解析并返回 LanguageModel 实例
 */

import type { LanguageModel } from 'ai';
import { providerRegistry, getProvider, type ProviderType } from './provider-registry';

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型 ID */
  id: string;
  /** 提供商 ID */
  providerId: string;
  /** 模型名称（提供商特定） */
  modelName: string;
  /** 上下文上限（token 数） */
  contextLimit: number;
  /** 是否默认模型 */
  isDefault?: boolean;
}

/**
 * 模型解析结果
 */
export interface ModelResolveResult {
  /** 是否成功 */
  ok: boolean;
  /** 模型实例（成功时） */
  model?: LanguageModel;
  /** 模型名称（成功时） */
  modelName?: string;
  /** 上下文上限（成功时） */
  contextLimit?: number;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 模型注册表（内存缓存）
 */
const modelRegistry = new Map<string, ModelConfig>();

/**
 * 注册模型配置
 * @param modelId - 模型 ID
 * @param config - 模型配置
 */
export function registerModelConfig(modelId: string, config: ModelConfig): void {
  modelRegistry.set(modelId, config);
  console.log(`模型配置已注册：${modelId} (${config.providerId}/${config.modelName})`);
}

/**
 * 获取模型配置
 * @param modelId - 模型 ID
 * @returns 模型配置（如果存在）
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return modelRegistry.get(modelId);
}

/**
 * 解析模型
 * 根据模型 ID 查找并创建 LanguageModel 实例
 * @param modelId - 模型 ID
 * @param userId - 用户 ID（用于查找用户自定义模型）
 * @returns 解析结果
 */
export async function resolveModel(
  modelId: string,
  userId?: string
): Promise<ModelResolveResult> {
  try {
    // 1. 查找模型配置
    const config = getModelConfig(modelId);
    
    if (!config) {
      // 2. 如果未找到，尝试使用默认 Provider
      const defaultProvider = providerRegistry.get('default');
      if (defaultProvider) {
        const model = defaultProvider.createModel(modelId);
        return {
          ok: true,
          model,
          modelName: modelId,
          contextLimit: 32000, // 默认上下文上限
        };
      }
      
      return {
        ok: false,
        error: `模型未找到：${modelId}`,
      };
    }

    // 3. 获取 Provider
    const provider = getProvider(config.providerId);
    
    if (!provider) {
      return {
        ok: false,
        error: `Provider 未找到：${config.providerId}`,
      };
    }

    // 4. 创建模型实例
    const model = provider.createModel(config.modelName);
    
    return {
      ok: true,
      model,
      modelName: config.modelName,
      contextLimit: config.contextLimit,
    };
  } catch (error) {
    console.error('模型解析失败:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '模型解析失败',
    };
  }
}

/**
 * 获取默认模型
 * @returns 默认模型 ID（如果存在）
 */
export function getDefaultModel(): string | undefined {
  for (const [id, config] of modelRegistry.entries()) {
    if (config.isDefault) {
      return id;
    }
  }
  return undefined;
}

/**
 * 获取所有已注册的模型
 * @returns 模型配置列表
 */
export function getAllModels(): ModelConfig[] {
  return Array.from(modelRegistry.values());
}

/**
 * 清除模型注册表（用于测试）
 */
export function clearModelRegistry(): void {
  modelRegistry.clear();
}
