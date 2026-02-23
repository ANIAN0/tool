/**
 * Agent工厂模块
 * 根据agentId动态创建ToolLoopAgent实例
 */

import { ToolLoopAgent, stepCountIs } from 'ai';
import type { LanguageModel } from 'ai';
import { getAgentConfig } from './config';
import { createToolsByTypes } from './tools';

/**
 * Agent创建结果
 */
export interface AgentCreateResult {
  agent: ToolLoopAgent;
  cleanup: () => Promise<void>;
}

/**
 * 创建Agent实例
 * 根据agentId加载配置并创建ToolLoopAgent
 * 
 * @param agentId - Agent唯一标识
 * @param model - 语言模型实例
 * @param customSystemPrompt - 可选的自定义系统提示词（用于注入记忆等）
 * @returns Agent实例和清理函数
 */
export async function createAgent(
  agentId: string,
  model: LanguageModel,
  customSystemPrompt?: string,
): Promise<AgentCreateResult> {
  // 获取Agent配置
  const config = getAgentConfig(agentId);
  
  // 创建工具集合（包含清理函数）
  const { tools, cleanup } = await createToolsByTypes(config.tools || []);
  
  // 使用自定义系统提示词或默认配置
  const systemPrompt = customSystemPrompt || config.systemPrompt;
  
  // 创建ToolLoopAgent实例
  const agent = new ToolLoopAgent({
    // 语言模型
    model,
    // 系统提示词（instructions）
    instructions: systemPrompt,
    // 工具集合
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    // 停止条件：最多执行10步
    stopWhen: stepCountIs(10),
  });
  
  return { agent, cleanup };
}

// 导出类型和配置
export { getAgentConfig, getAgentList, DEFAULT_AGENT_ID, AGENTS, type AgentConfig } from './config';
export { createToolsByTypes, type ToolType, type ToolsCreateResult } from './tools';
