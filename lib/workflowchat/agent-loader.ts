/**
 * Agent 配置加载器模块
 * 负责从数据库加载 Agent 配置并解析运行时参数
 * 
 * 支持：userId 校验、runtime 参数解析、skills 关联获取
 */

import type { Agent, AgentWithTools } from '@/lib/schemas';
import { getAgentById, getAgentSkillsInfo } from '@/lib/db';

/**
 * Agent 运行时配置
 * 从 template_config JSON 解析
 */
export interface AgentRuntimeConfig {
  /** 最大执行步数 */
  maxSteps: number;
}

/**
 * 解析 Agent 运行时配置
 * 从 template_config 字段解析 maxSteps
 *
 * @param agent - Agent 数据库记录
 * @returns 运行时配置对象
 */
export function parseRuntimeConfig(agent: Agent): AgentRuntimeConfig {
  if (agent.template_config) {
    try {
      const config = JSON.parse(agent.template_config) as Record<string, unknown>;
      return {
        maxSteps: typeof config.maxSteps === 'number' ? config.maxSteps : 50,
      };
    } catch {
      return { maxSteps: 50 };
    }
  }
  return { maxSteps: 50 };
}

/**
 * 工具配置
 * 描述 Agent 关联的工具
 */
export interface ToolConfig {
  /** 工具 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具来源：system | mcp */
  source: 'system' | 'mcp';
  /** MCP 服务器名称（仅 MCP 工具） */
  serverName?: string;
}

/**
 * Skill 配置
 * 描述 Agent 关联的 Skill
 */
export interface SkillConfig {
  /** Skill ID */
  id: string;
  /** Skill 名称 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** Skill 存储路径 */
  storagePath: string | null;
  /** 文件哈希（用于版本检测） */
  fileHash: string | null;
}

/**
 * Agent 完整配置
 * 运行时不包含敏感信息
 */
export interface AgentConfig {
  /** Agent ID */
  id: string;
  /** Agent 名称 */
  name: string;
  /** 系统提示词（来自 agents.system_prompt） */
  systemPrompt: string;
  /** 模型 ID */
  modelId: string | null;
  /** 最大执行步数 */
  maxSteps: number;
  /** 工具配置列表 */
  tools: ToolConfig[];
  /** Skill 配置列表 */
  skills: SkillConfig[];
}

/**
 * 加载 Agent 配置结果
 */
export interface LoadAgentConfigResult {
  /** 是否成功 */
  ok: boolean;
  /** Agent 配置（成功时） */
  agent?: AgentConfig;
  /** 错误消息（失败时） */
  error?: string;
  /** HTTP 状态码（失败时） */
  status?: number;
}

/**
 * 加载 Agent 配置并校验访问权限
 * 
 * 权限规则：
 * - 公开 Agent：所有人可用
 * - 私有 Agent：仅创建者可用
 * 
 * @param userId - 当前用户 ID
 * @param agentId - Agent ID
 * @returns Agent 配置结果
 */
export async function loadAgentConfig(
  userId: string,
  agentId: string
): Promise<LoadAgentConfigResult> {
  // 1. 获取 Agent（数据库层已做权限验证）
  const agentWithTools = await getAgentById(agentId, userId);
  
  if (!agentWithTools) {
    return {
      ok: false,
      error: 'Agent 不存在或无权访问',
      status: 404,
    };
  }
  
  // 2. 解析运行时配置
  const runtimeConfig = parseRuntimeConfig(agentWithTools);
  
  // 4. 获取关联的 Skills
  const skillsInfo = await getAgentSkillsInfo(agentId);
  
  // 5. 构建工具配置列表
  const tools: ToolConfig[] = (agentWithTools.tools || []).map((tool) => ({
    id: tool.id,
    name: tool.name,
    source: tool.source,
    serverName: tool.serverName,
  }));
  
  // 6. 构建 Skill 配置列表
  const skills: SkillConfig[] = skillsInfo.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    storagePath: skill.storagePath,
    fileHash: skill.fileHash,
  }));
  
  // 7. 返回完整配置
  return {
    ok: true,
    agent: {
      id: agentWithTools.id,
      name: agentWithTools.name,
      systemPrompt: agentWithTools.system_prompt || '',
      modelId: agentWithTools.model_id,
      maxSteps: runtimeConfig.maxSteps,
      tools,
      skills,
    },
  };
}

/**
 * 获取默认运行时配置
 * 用于模板创建时的默认值
 * 
 * @returns 默认运行时配置
 */
export function getDefaultRuntimeConfig(): AgentRuntimeConfig {
  return {
    maxSteps: 50,
  };
}