/**
 * WorkflowChat 模型解析器
 * 支持环境变量默认 + 前端 modelId 覆盖的模型解析策略
 *
 * 解析流程：
 * 1. modelId 有值 → 使用 modelId 作为模型名
 * 2. modelId 为空 → 使用环境变量 WORKFLOWCHAT_MODEL 作为模型名
 * 3. API Key 和 baseURL 始终来自环境变量（首版所有请求共享同一配置）
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3 } from "@ai-sdk/provider";

/** 环境变量键名常量 */
const ENV_API_KEY = "WORKFLOWCHAT_API_KEY";
const ENV_BASE_URL = "WORKFLOWCHAT_BASE_URL";
const ENV_MODEL = "WORKFLOWCHAT_MODEL";

/** baseURL 默认值（OpenAI 官方端点） */
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * 仅解析模型名称，不创建模型实例
 * 用于服务层在启动 workflow 时需要 modelId 但不需要 LanguageModelV3 的场景
 *
 * @param modelId - 可选模型名称，不传时使用环境变量默认值
 * @returns 解析后的模型名称
 * @throws 环境变量缺失时抛出明确错误
 */
export function resolveWorkflowChatModelId(modelId?: string): string {
  const modelName = modelId || process.env[ENV_MODEL];
  if (!modelName) {
    throw new Error(
      `未指定模型名称且环境变量 ${ENV_MODEL} 未配置，请传入 modelId 或设置 ${ENV_MODEL}`
    );
  }
  return modelName;
}

/**
 * 解析 WorkflowChat 模型并构建聊天模型实例
 *
 * @param modelId - 可选模型名称（如 "gpt-4.1-mini"），不传时使用环境变量默认值
 * @returns LanguageModelV3 实例
 * @throws 环境变量缺失时抛出明确错误
 */
export function resolveWorkflowChatModel(modelId?: string): LanguageModelV3 {
  // 读取必填环境变量：API Key
  const apiKey = process.env[ENV_API_KEY];
  if (!apiKey) {
    throw new Error(`环境变量 ${ENV_API_KEY} 未配置，WorkflowChat 模型不可用`);
  }

  // 读取可选环境变量：baseURL，未配置时使用默认值
  const baseURL = process.env[ENV_BASE_URL] || DEFAULT_BASE_URL;

  // 解析模型名称（复用 resolveWorkflowChatModelId）
  const modelName = resolveWorkflowChatModelId(modelId);

  console.log("[resolveWorkflowChatModel] modelName:", modelName, "baseURL:", baseURL, "apiKey已配置:", !!apiKey);

  // 创建 OpenAI-Compatible provider（与现有 buildChatModelFromUserModel 同模式）
  const provider = createOpenAICompatible({
    name: "workflowchat-openai-compatible",
    baseURL,
    apiKey,
  });

  // 返回具体聊天模型实例
  return provider.chatModel(modelName);
}
