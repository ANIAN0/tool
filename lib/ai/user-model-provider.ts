/**
 * AI SDK Provider 工厂
 * 根据用户模型配置创建兼容 OpenAI 的 Provider
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type UserModel } from "@/lib/db";
import { decryptApiKey } from "@/lib/encryption";

/**
 * 支持的 Provider 类型
 */
export type SupportedProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "openrouter"
  | "siliconflow"
  | "custom";

/**
 * Provider 默认配置
 */
const PROVIDER_DEFAULTS: Record<
  SupportedProvider,
  { baseURL: string; name: string }
> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    name: "OpenAI",
  },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    name: "Anthropic",
  },
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    name: "Google",
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    name: "DeepSeek",
  },
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    name: "OpenRouter",
  },
  siliconflow: {
    baseURL: "https://api.siliconflow.cn/v1",
    name: "SiliconFlow",
  },
  custom: {
    baseURL: "",
    name: "Custom",
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
    // 解密 API Key
    const apiKey = decryptApiKey(userModel.api_key);

    // 确定 baseURL
    let baseURL: string;
    if (userModel.base_url) {
      // 使用用户自定义的 baseURL
      baseURL = userModel.base_url;
    } else {
      // 使用 Provider 默认值
      const defaults = PROVIDER_DEFAULTS[userModel.provider as SupportedProvider];
      if (!defaults) {
        throw new Error(`未知的 Provider: ${userModel.provider}`);
      }
      baseURL = defaults.baseURL;
    }

    // 验证配置
    if (!baseURL) {
      throw new Error("baseURL 不能为空，请提供自定义 baseURL 或选择已知 Provider");
    }

    if (!apiKey) {
      throw new Error("API Key 无效或为空");
    }

    const providerName =
      PROVIDER_DEFAULTS[userModel.provider as SupportedProvider]?.name ||
      userModel.provider;

    return {
      baseURL,
      apiKey,
      name: providerName,
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
  return (
    PROVIDER_DEFAULTS[provider as SupportedProvider]?.baseURL || ""
  );
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
  return (
    PROVIDER_DEFAULTS[provider as SupportedProvider]?.name || provider
  );
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
  return Object.entries(PROVIDER_DEFAULTS).map(([id, config]) => ({
    id: id as SupportedProvider,
    name: config.name,
    baseURL: config.baseURL,
  }));
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
