/**
 * WorkflowChat Agent 定义
 * 导出 ToolLoopAgent 工厂函数、系统提示词构建、工具集创建
 */

import type { LanguageModel, ToolSet } from 'ai';
import { ToolLoopAgent, stepCountIs } from "ai";

/** 默认系统提示词 */
const DEFAULT_SYSTEM_PROMPT = "你是一个 WorkflowChat 助手，请根据用户消息提供有帮助的回复。";

/** 默认最大执行步数 */
const DEFAULT_MAX_STEP_COUNT = 50;

/** 默认空工具集 */
const DEFAULT_EMPTY_TOOLS: ToolSet = {};

/** 系统提示词构建函数，支持自定义指令覆盖 */
export function buildSystemPrompt(customInstructions?: string): string {
  // 如果提供了自定义指令，则覆盖默认提示词
  return customInstructions ?? DEFAULT_SYSTEM_PROMPT;
}

/**
 * 创建 WorkflowChat ToolLoopAgent 实例的工厂函数
 * 支持外部传入模型、工具和运行时参数
 *
 * @param options - 配置选项
 * @param options.model - 可选外部传入的语言模型实例
 * @param options.maxSteps - 最大执行步数，默认 50
 * @param options.customInstructions - 自定义指令，覆盖默认系统提示词
 * @param options.tools - 工具集合，默认为空对象
 * @returns ToolLoopAgent 实例
 */
export function createWorkflowChatAgent(options?: {
  model?: LanguageModel;
  maxSteps?: number;
  customInstructions?: string;
  tools?: ToolSet;
}): ToolLoopAgent {
  const model = options?.model;
  // 使用传入的 maxSteps 或默认值
  const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEP_COUNT;
  // 使用传入的 tools 或默认空工具集
  const tools = options?.tools ?? DEFAULT_EMPTY_TOOLS;

  return new ToolLoopAgent({
    model,
    instructions: buildSystemPrompt(options?.customInstructions),
    tools,
    stopWhen: stepCountIs(maxSteps), // 动态步数控制
  });
}