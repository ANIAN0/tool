/**
 * Agent配置模块
 * 管理多个Agent的系统提示词配置
 */

/**
 * Agent配置接口
 * 定义单个Agent的属性
 */
export interface AgentConfig {
  // Agent唯一标识
  id: string;
  // 显示名称
  name: string;
  // 描述信息
  description: string;
  // 系统提示词
  systemPrompt: string;
  // 工具类型列表（可选，默认根据agentId自动匹配）
  tools?: Array<'bash' | 'tavily' | 'mcp'>;
}

/**
 * 预定义的Agent列表
 * 包含正式Agent和开发Agent
 */
export const AGENTS: AgentConfig[] = [
  {
    id: "production",
    name: "正式Agent",
    description: "正式环境使用的Agent，提供稳定可靠的AI服务",
    systemPrompt: `你是一个有帮助的AI助手，名叫助手1号。

请遵循以下原则：
1. 用中文回答问题，保持友好和专业的态度
2. 如果用户询问代码相关的问题，请提供清晰、可运行的代码示例
3. 对于复杂问题，分步骤给出解答
4. 如果不确定答案，请诚实告知`,
    tools: ['bash'],
  },
  {
    id: "development",
    name: "开发Agent",
    description: "开发测试使用的Agent，用于新功能测试和调试",
    systemPrompt: `你是一个有帮助的AI助手，名叫助手2号。

当前处于开发测试模式，请注意：
1. 用中文回答问题
2. 可以更自由地探索和尝试不同的回答方式
3. 如果发现问题，请详细描述
4. 每次回复前，先简要说明你的思考过程`,
    tools: ['bash', 'tavily', 'mcp'],
  },
];

/**
 * 默认Agent ID
 * 当未指定Agent时使用
 */
export const DEFAULT_AGENT_ID = "production";

/**
 * 根据Agent ID获取Agent配置
 * @param agentId - Agent唯一标识
 * @returns Agent配置，如果未找到则返回默认Agent
 */
export function getAgentConfig(agentId: string): AgentConfig {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (agent) {
    return agent;
  }
  // 未找到时返回默认Agent
  return AGENTS.find((a) => a.id === DEFAULT_AGENT_ID)!;
}

/**
 * 获取所有Agent的简要信息（不包含系统提示词）
 * 用于前端展示Agent列表
 */
export function getAgentList(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return AGENTS.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

/**
 * 检查Agent ID是否有效
 * @param agentId - Agent唯一标识
 * @returns 是否为有效的Agent ID
 */
export function isValidAgentId(agentId: string): boolean {
  return AGENTS.some((a) => a.id === agentId);
}
