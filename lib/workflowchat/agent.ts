/**
 * WorkflowChat Agent 定义
 * 导出 ToolLoopAgent 工厂函数、系统提示词构建、首版空工具集
 */

import { ToolLoopAgent, stepCountIs } from "ai";
import { resolveWorkflowChatModel } from "./model-resolver";

/** 首版工具集 — 空数组，后续迭代逐步添加工具 */
export const workflowChatTools: Record<string, never> = {};

/** 系统提示词构建函数 */
export function buildSystemPrompt(): string {
  return "你是一个 WorkflowChat 助手，请根据用户消息提供有帮助的回复。";
}

/** Agent 最大执行步数 */
const MAX_STEP_COUNT = 10;

/**
 * 创建 WorkflowChat ToolLoopAgent 实例的工厂函数
 *
 * @param modelId - 可选模型名称，不传时使用环境变量默认值
 * @returns ToolLoopAgent 实例
 */
export function createWorkflowChatAgent(modelId?: string): ToolLoopAgent {
  // 使用 workflowchat 专用模型解析器
  const model = resolveWorkflowChatModel(modelId);

  return new ToolLoopAgent({
    model,
    instructions: buildSystemPrompt(),
    tools: workflowChatTools,
    stopWhen: stepCountIs(MAX_STEP_COUNT),
  });
}