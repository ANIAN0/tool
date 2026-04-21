/**
 * Constants 统一导出入口
 * 所有常量都可从此文件导入
 * 此模块不依赖其他业务模块，作为顶层依赖源
 */

// 系统工具常量
export {
  SYSTEM_TOOL_IDS,
  getDefaultSystemTools,
  validateSystemToolIds,
  parseSystemTools,
  serializeSystemTools,
  isSystemToolId,
  SYSTEM_TOOLS_META,
} from './system-tools';
export type {
  SystemToolId,
  SystemToolMeta,
} from './system-tools';

// Agent配置常量
export {
  DEFAULT_AGENT_ID,
  AGENT_TEMPLATE_IDS,
  isValidTemplateId,
  getDefaultTemplateId,
  DEFAULT_SYSTEM_PROMPT,
  MAX_AGENT_TOOLS,
  MAX_AGENT_SKILLS,
  DEFAULT_AGENT_CONFIG,
  AGENT_STATUS_LIST,
} from './agent-config';
export type {
  AgentTemplateId,
  AgentStatus,
} from './agent-config';