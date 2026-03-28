/**
 * AI SDK Provider 工厂
 * 根据用户模型配置创建 OpenAI-Compatible Provider
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type UserModel } from "@/lib/db";
import { decryptApiKey } from "@/lib/encryption";

/**
 * 支持的 Provider 类型
 * 当前仅支持 openai（代表 OpenAI-Compatible 协议）
 */
export type SupportedProvider = "openai";

/**
 * Provider 默认配置
 */
const PROVIDER_DEFAULTS: Record<
  SupportedProvider,
  { baseURL: string; name: string }
> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    name: "OpenAI-Compatible",
  },
};

/**
 * Provider 配置接口
 */
export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  name: string;
}

/**
 * 根据用户模型创建 Provider 配置
 *
 * @param userModel - 用户模型配置
 * @returns Provider 配置
 * @throws 如果解密失败或配置无效
 */
export function createProviderConfig(userModel: UserModel): ProviderConfig {
  try {
    // 仅允许 openai，防止其他 provider 混入运行时
    if (userModel.provider !== "openai") {
      throw new Error("当前仅支持 OpenAI-Compatible（provider=openai）");
    }

    // 解密 API Key
    const apiKey = decryptApiKey(userModel.api_key);

    // 确定 baseURL
    let baseURL: string;
    if (userModel.base_url) {
      // 使用用户自定义的 baseURL
      baseURL = userModel.base_url;
    } else {
      // 使用 Provider 默认值
      baseURL = PROVIDER_DEFAULTS.openai.baseURL;
    }

    // 验证配置
    if (!baseURL) {
      throw new Error("baseURL 不能为空，请提供自定义 baseURL 或选择已知 Provider");
    }

    if (!apiKey) {
      throw new Error("API Key 无效或为空");
    }

    return {
      baseURL,
      apiKey,
      name: PROVIDER_DEFAULTS.openai.name,
    };
  } catch (error) {
    console.error("创建 Provider 配置失败:", error);
    throw new Error(
      `无法创建 Provider 配置: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * 创建 AI SDK Provider
 *
 * @param userModel - 用户模型配置
 * @returns OpenAI Compatible Provider 实例
 * @throws 如果配置无效或创建失败
 *
 * @example
 * ```ts
 * const provider = createUserModelProvider(userModel);
 * const model = provider.chatModel(userModel.model);
 * ```
 */
export function createUserModelProvider(userModel: UserModel) {
  const config = createProviderConfig(userModel);

  return createOpenAICompatible({
    name: config.name,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
}

/**
 * 获取 Provider 的默认 baseURL
 *
 * @param provider - Provider 类型
 * @returns 默认 baseURL，如果未知则返回空字符串
 */
export function getProviderDefaultBaseURL(
  provider: SupportedProvider | string
): string {
  // 非 openai 直接返回空字符串，前端会按“仅支持 openai”处理
  return provider === "openai" ? PROVIDER_DEFAULTS.openai.baseURL : "";
}

/**
 * 获取 Provider 的显示名称
 *
 * @param provider - Provider 类型
 * @returns 显示名称
 */
export function getProviderDisplayName(
  provider: SupportedProvider | string
): string {
  // 仅 openai 显示 OpenAI-Compatible，其他值原样返回便于调试
  return provider === "openai" ? PROVIDER_DEFAULTS.openai.name : provider;
}

/**
 * 获取所有支持的 Provider 列表
 *
 * @returns Provider 列表
 */
export function getSupportedProviders(): Array<{
  id: SupportedProvider;
  name: string;
  baseURL: string;
}> {
  // 仅返回单一 provider，确保前端表单与后端能力一致
  return [
    {
      id: "openai",
      name: PROVIDER_DEFAULTS.openai.name,
      baseURL: PROVIDER_DEFAULTS.openai.baseURL,
    },
  ];
}

/**
 * 验证 Provider 配置是否有效
 *
 * @param userModel - 用户模型配置
 * @returns 验证结果
 */
export function validateUserModel(
  userModel: UserModel
): { valid: boolean; error?: string } {
  try {
    createProviderConfig(userModel);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
