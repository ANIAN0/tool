/**
 * WorkflowChat Agent 定义
 * 导出 ToolLoopAgent 工厂函数、工具集创建
 *
 * 设计变更：Agent 使用 stepCountIs(1) 固定单步，
 * 外部 workflow 循环控制多轮推理。
 */

import type { LanguageModel, ToolSet } from 'ai';
import { ToolLoopAgent, stepCountIs } from "ai";

/** 默认空工具集 */
const DEFAULT_EMPTY_TOOLS: ToolSet = {};

/**
 * 创建 WorkflowChat ToolLoopAgent 实例的工厂函数
 * 支持外部传入模型、工具和运行时参数
 *
 * 重要：Agent 使用 stepCountIs(1) 固定单步执行，
 * 多轮推理由外部 workflow 循环控制。
 *
 * @param options - 配置选项
 * @param options.model - 可选外部传入的语言模型实例
 * @param options.instructions - 系统提示词，直接来自 agents.system_prompt
 * @param options.tools - 工具集合，默认为空对象
 * @returns ToolLoopAgent 实例
 */
export function createWorkflowChatAgent(options?: {
  model?: LanguageModel;
  instructions?: string;
  tools?: ToolSet;
}): ToolLoopAgent {
  const model = options?.model;
  // 使用传入的 tools 或默认空工具集
  const tools = options?.tools ?? DEFAULT_EMPTY_TOOLS;

  return new ToolLoopAgent({
    model,
    // 直接使用 instructions，不再经过 buildSystemPrompt 处理
    instructions: options?.instructions,
    tools,
    // 固定单步执行，外部循环控制多轮推理
    stopWhen: stepCountIs(1),
  });
}