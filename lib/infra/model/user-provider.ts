/**
 * 用户模型 Provider
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
 * 用户 Provider 配置接口
 */
export interface UserProviderConfig {
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
export function createUserProviderConfig(userModel: UserModel): UserProviderConfig {
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
      baseURL = userModel.base_url;
    } else {
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
 * 创建用户模型 Provider
 *
 * @param userModel - 用户模型配置
 * @returns OpenAI Compatible Provider 实例
 * @throws 如果配置无效或创建失败
 */
export function createUserModelProvider(userModel: UserModel) {
  const config = createUserProviderConfig(userModel);

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
  return [
    {
      id: "openai",
      name: PROVIDER_DEFAULTS.openai.name,
      baseURL: PROVIDER_DEFAULTS.openai.baseURL,
    },
  ];
}

/**
 * 验证用户模型配置是否有效
 *
 * @param userModel - 用户模型配置
 * @returns 验证结果
 */
export function validateUserModel(
  userModel: UserModel
): { valid: boolean; error?: string } {
  try {
    createUserProviderConfig(userModel);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}