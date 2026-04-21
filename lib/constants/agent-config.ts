/**
 * Agent配置常量定义
 * 消除反向依赖，作为顶层依赖源
 */

/**
 * 默认Agent ID
 * 用于未指定Agent时的默认值
 */
export const DEFAULT_AGENT_ID = 'production';

/**
 * Agent模板ID列表
 * 定义可用的Agent模板类型
 */
export const AGENT_TEMPLATE_IDS = [
  'default',      // 默认模板（基础对话）
  'custom',       // 自定义模板
  'loop',         // 循环模板（持续执行）
  'single',       // 单次执行模板
] as const;

/**
 * Agent模板ID类型
 */
export type AgentTemplateId = typeof AGENT_TEMPLATE_IDS[number];

/**
 * 验证模板ID是否有效
 * @param templateId - 待验证的模板ID
 * @returns 是否为有效模板ID
 */
export function isValidTemplateId(templateId: string): boolean {
  return AGENT_TEMPLATE_IDS.includes(templateId as AgentTemplateId);
}

/**
 * 获取默认模板ID
 * @returns 默认模板ID
 */
export function getDefaultTemplateId(): AgentTemplateId {
  return 'default';
}

/**
 * Agent系统提示词默认值
 */
export const DEFAULT_SYSTEM_PROMPT = '';

/**
 * Agent最大工具数量限制
 */
export const MAX_AGENT_TOOLS = 50;

/**
 * Agent最大Skill数量限制
 */
export const MAX_AGENT_SKILLS = 20;

/**
 * Agent配置默认值
 */
export const DEFAULT_AGENT_CONFIG = {
  templateId: 'default',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  isPublic: false,
} as const;

/**
 * Agent状态类型
 */
export type AgentStatus = 'active' | 'inactive' | 'archived';

/**
 * Agent状态列表
 */
export const AGENT_STATUS_LIST = ['active', 'inactive', 'archived'] as const;