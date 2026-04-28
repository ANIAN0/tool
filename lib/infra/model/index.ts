/**
 * ModelService
 * 统一模型创建入口
 */

import type { LanguageModel } from 'ai';
import { getUserModelById, getUserModels } from '@/lib/db/user-models';
import { createUserModelProvider } from './user-provider';
import { wrapModelWithDevTools } from './middleware';
import type { ProviderRegistration, ProviderType } from './provider-registry';

/**
 * ModelService 错误类型
 */
export class ModelServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelServiceError';
  }
}

/**
 * 创建模型参数
 */
export interface CreateModelParams {
  /** 模型 ID */
  modelId: string;
  /** 用户 ID */
  userId: string;
  /** 是否包装 DevTools（可选，默认开发环境自动启用） */
  wrapDevTools?: boolean;
}

/**
 * 创建模型结果
 */
export interface CreateModelResult {
  /** 语言模型实例 */
  model: LanguageModel;
  /** 模型名称 */
  modelName: string;
  /** 上下文上限 */
  contextLimit: number;
  /** 清理函数 */
  cleanup: () => void;
}

/**
 * Provider 注册信息（简化版）
 */
interface ProviderInfo {
  id: string;
  type: ProviderType;
  createModel: (modelId: string) => LanguageModel;
}

/**
 * ModelService 类
 * 统一模型创建入口
 */
class ModelService {
  private providers = new Map<string, ProviderInfo>();

  /**
   * 注册 Provider
   * @param id - Provider ID
   * @param registration - 注册信息
   */
  registerProvider(id: string, registration: ProviderRegistration): void {
    this.providers.set(id, {
      id: registration.id,
      type: registration.type,
      createModel: registration.createModel,
    });
    console.log(`ModelService: Provider 已注册 - ${id} (${registration.type})`);
  }

  /**
   * 创建语言模型
   * 校验不通过直接抛出 ModelServiceError('MODEL_NOT_FOUND')
   * @param params - 创建参数
   * @returns 创建结果
   */
  async createModel(params: CreateModelParams): Promise<CreateModelResult> {
    const { modelId, userId, wrapDevTools } = params;

    // 1. 校验模型是否存在（先按 modelId 查询）
    const allModels = await getUserModels(userId);
    const userModel = allModels.find(m => m.id === modelId);
    
    if (!userModel) {
      // 2. 检查模型是否存在（不区分用户）
      const anyModel = await getUserModelById(userId, modelId).catch(() => null);
      if (!anyModel) {
        throw new ModelServiceError(`MODEL_NOT_FOUND: ${modelId}`);
      }
      // 模型存在但不属于该用户
      throw new ModelServiceError(`USER_MISMATCH: ${modelId}`);
    }

    // 2. 创建 Provider 并生成模型
    let provider;
    try {
      provider = createUserModelProvider(userModel);
    } catch (error) {
      throw new ModelServiceError(
        `创建 Provider 失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }

    let model: LanguageModel;
    try {
      model = provider(userModel.model);
    } catch (error) {
      throw new ModelServiceError(
        `创建模型失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }

    // 3. 包装 DevTools（开发环境默认启用）
    const shouldWrapDevTools = wrapDevTools ?? (process.env.NODE_ENV === 'development');
    if (shouldWrapDevTools) {
      model = wrapModelWithDevTools(model);
    }

    // 4. 返回结果和清理函数
    return {
      model,
      modelName: userModel.model,
      contextLimit: userModel.context_limit,
      cleanup: () => {
        // 清理函数，目前为空占位
      },
    };
  }
}

// 导出单例
export const modelService = new ModelService();

/**
 * ModelService.createModel 的便捷函数
 */
export async function createModel(params: CreateModelParams): Promise<CreateModelResult> {
  return modelService.createModel(params);
}

/**
 * 注册 Provider 的便捷函数
 */
export function registerProvider(
  id: string,
  registration: ProviderRegistration
): void {
  modelService.registerProvider(id, registration);
}

// 导出类型
export type { ProviderRegistration, ProviderType };