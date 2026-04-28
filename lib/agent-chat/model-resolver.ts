/**
 * 模型解析模块
 * 使用公共设施层 ModelService 统一创建模型
 */

import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  getUserModelById,
  getDefaultUserModel,
  type UserModel,
} from "@/lib/db";
import { decryptApiKey } from "@/lib/encryption";
import { wrapModelWithAllMiddlewares } from "@/lib/ai";
import type { ModelResolveResult } from "./types";

/**
 * 包装聊天模型（应用压缩检测中间件）
 * 直接转发 wrapModelWithAllMiddlewares 调用
 */
export const wrapModel = wrapModelWithAllMiddlewares;

/**
 * 根据用户模型配置构建聊天模型
 * 当前仅支持 provider=openai（OpenAI-Compatible 协议）
 *
 * @param userModel - 用户模型配置
 * @returns 构建结果（成功返回聊天模型实例，失败返回错误信息）
 */
export function buildChatModelFromUserModel(userModel: UserModel): { ok: true; model: LanguageModelV3 } | { ok: false; error: string } {
  // 校验 provider，确保与文档和前端能力一致
  if (userModel.provider !== "openai") {
    return { ok: false, error: "当前仅支持 OpenAI-Compatible（provider=openai）" };
  }

  // 解密数据库中存储的密文 API Key
  const decryptedApiKey = decryptApiKey(userModel.api_key);
  // 使用用户填写的 base_url；未填写时回退到 OpenAI 官方端点
  const baseURL = userModel.base_url || "https://api.openai.com/v1";

  // 动态导入避免循环依赖
  const { createOpenAICompatible } = require("@ai-sdk/openai-compatible");

  // 创建 OpenAI-Compatible provider
  const provider = createOpenAICompatible({
    name: "user-openai-compatible",
    baseURL,
    apiKey: decryptedApiKey,
  });

  // 返回具体聊天模型实例
  return { ok: true, model: provider.chatModel(userModel.model) };
}

/**
 * 解析模型配置并构建聊天模型实例
 *
 * @param agentOwnerId - Agent 创建者的用户 ID（用于查询 Agent 绑定的模型）
 * @param agentModelId - Agent 绑定的模型 ID（null 表示使用用户默认模型）
 * @param userId - 当前请求用户的 ID（用于查询默认模型）
 * @returns 模型解析结果（成功返回模型实例，失败返回错误响应）
 */
export async function resolveModel(
  agentOwnerId: string,
  agentModelId: string | null,
  userId: string
): Promise<ModelResolveResult> {
  // 获取模型配置
  let userModel: UserModel | null = null;

  if (agentModelId) {
    // Agent 绑定了模型：使用创建者的模型池中该模型
    const modelConfig = await getUserModelById(agentOwnerId, agentModelId);
    if (!modelConfig) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "Agent关联的模型不存在" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    userModel = modelConfig;
  } else {
    // Agent 未绑定模型：使用当前用户的默认模型
    const defaultModel = await getDefaultUserModel(userId);
    if (!defaultModel) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "请先在设置页配置并设为默认模型（OpenAI-Compatible）" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    userModel = defaultModel;
  }

  // 构建聊天模型实例
  const buildResult = buildChatModelFromUserModel(userModel);
  if (!buildResult.ok) {
    // 模型构建失败（如 provider 不支持）
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: buildResult.error }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const chatModel = buildResult.model;
  const modelName = userModel.model;
  // 获取模型上下文上限（用于压缩检测）
  const contextLimit = userModel.context_limit ?? 32000;

  return {
    ok: true,
    chatModel,
    modelName,
    userModel,
    contextLimit,
  };
}