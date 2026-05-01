/**
 * Skill 加载服务
 * 从数据库加载 Agent 配置的 Skills 并注册到 ToolRegistry
 *
 * 设计目标：
 * - 从数据库获取 Agent 的 Skill 配置
 * - 将 Skills 转换为工具定义并注册
 * - 提供批量加载和注册能力
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { registerTool } from '@/lib/infra/tools';
import type { ToolCreateResult } from '@/lib/infra/tools/registry';
import {
  createSkillToolDefinition,
  createSpecificSkillToolDefinition,
} from './skill-tool';
import type {
  SkillExecutionContext,
  SkillLoadResult,
} from './types';
import { registerSkill, loadSkill, clearSkillRegistry, getRegisteredSkills } from './loader';
import type { SkillDefinition, SkillMeta } from './core-types';
import { extractSkillBody } from './validator';

// ==================== Skill 数据模型查询 ====================

/**
 * Skill 数据信息（从数据库查询）
 */
interface SkillDataInfo {
  id: string;
  name: string;
  description: string;
  storagePath: string | null;
  fileHash: string | null;
}

/**
 * 从数据库获取 Agent 的 Skills 信息
 * 注意：这里提供接口，实际数据库查询在 lib/db/agents.ts 中实现
 *
 * @param agentId - Agent ID
 * @returns Skill 数据信息列表
 */
export async function getAgentSkillDataInfos(
  agentId: string
): Promise<SkillDataInfo[]> {
  // 动态导入数据库查询函数，避免循环依赖
  const { getAgentSkillsInfo } = await import('@/lib/db/agents');

  // 获取 Agent 关联的 Skills 信息
  const skills = await getAgentSkillsInfo(agentId);

  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    storagePath: skill.storagePath,
    fileHash: skill.fileHash,
  }));
}

/**
 * 获取多个 Agent 的 Skills 信息（批量查询）
 *
 * @param agentIds - Agent ID 列表
 * @returns Map<agentId, SkillDataInfo[]>
 */
export async function getAgentsSkillDataInfosBatch(
  agentIds: string[]
): Promise<Map<string, SkillDataInfo[]>> {
  if (agentIds.length === 0) {
    return new Map();
  }

  // 动态导入数据库查询函数
  const { getAgentsSkillsBatch } = await import('@/lib/db/skills');

  // 批量查询
  const skillsMap = await getAgentsSkillsBatch(agentIds);

  // 转换格式
  const result = new Map<string, SkillDataInfo[]>();
  skillsMap.forEach((skills, agentId) => {
    result.set(agentId, skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      storagePath: null, // 批量查询不含 storagePath
      fileHash: null, // 批量查询不含 fileHash
    })));
  });

  return result;
}

// ==================== Skill 加载到 step 函数 ====================

/**
 * Skill 加载选项
 */
export interface SkillLoadOptions {
  // Agent ID
  agentId: string;
  // 用户 ID
  userId: string;
  // 对话 ID（可选）
  conversationId?: string;
  // 工作目录（默认为当前目录）
  workingDirectory?: string;
  // 是否注册专属工具（默认为 true）
  registerSpecificTools?: boolean;
}

/**
 * 加载 Agent 的 Skills 并注册到 ToolRegistry
 *
 * 流程：
 * 1. 从数据库获取 Agent 的 Skill 配置列表
 * 2. 构建 Skill 执行上下文
 * 3. 为每个 Skill 创建工具定义
 * 4. 注册到 ToolRegistry
 *
 * @param options - 加载选项
 * @returns 加载结果
 */
export async function loadAgentSkills(options: SkillLoadOptions): Promise<SkillLoadResult> {
  const {
    agentId,
    userId,
    conversationId,
    workingDirectory = process.cwd(),
    registerSpecificTools = true,
  } = options;

  const result: SkillLoadResult = {
    success: true,
    loadedSkillIds: [],
    failedSkills: [],
    toolDefinitions: [],
  };

  // 构建执行上下文
  const context: SkillExecutionContext = {
    userId,
    agentId,
    conversationId,
    workingDirectory,
  };

  // 从数据库获取 Agent 的 Skills
  const skillDataInfos = await getAgentSkillDataInfos(agentId);

  if (skillDataInfos.length === 0) {
    return result;
  }

  // 注册通用的 execute_skill 工具
  const executeSkillToolDef = createSkillToolDefinition(context);
  registerTool(executeSkillToolDef, 'overwrite');
  result.toolDefinitions.push({
    skillId: 'execute_skill',
    skillName: 'execute_skill',
    skillDescription: '执行指定的 Skill',
    inputSchema: {},
  });

  // 为每个 Skill 创建并注册工具
  for (const skillInfo of skillDataInfos) {
    // 创建专属工具定义
    const toolDef = createSpecificSkillToolDefinition(skillInfo.id, context);

    if (toolDef) {
      // 注册到 ToolRegistry
      registerTool(toolDef, 'overwrite');
      result.loadedSkillIds.push(skillInfo.id);
      result.toolDefinitions.push({
        skillId: skillInfo.id,
        skillName: skillInfo.name,
        skillDescription: skillInfo.description,
        inputSchema: {},
      });
    } else {
      // Skill 未注册到 SkillRegistry
      result.failedSkills.push({
        skillId: skillInfo.id,
        error: 'Skill definition not found in registry',
      });
    }
  }

  // 如果所有 Skill 都失败，标记为失败
  if (result.failedSkills.length === skillDataInfos.length) {
    result.success = false;
  }

  return result;
}

/**
 * 批量加载多个 Agent 的 Skills
 *
 * @param agentIds - Agent ID 列表
 * @param userId - 用户 ID
 * @returns 加载结果 Map
 */
export async function loadAgentsSkillsBatch(
  agentIds: string[],
  userId: string
): Promise<Map<string, SkillLoadResult>> {
  const results = new Map<string, SkillLoadResult>();

  // 批量获取 Skills 信息
  const skillsMap = await getAgentsSkillDataInfosBatch(agentIds);

  // 为每个 Agent 加载 Skills
  for (const agentId of agentIds) {
    const skills = skillsMap.get(agentId) || [];
    results.set(agentId, {
      success: skills.length > 0,
      loadedSkillIds: skills.map((s) => s.id),
      failedSkills: [],
      toolDefinitions: skills.map((s) => ({
        skillId: s.id,
        skillName: s.name,
        skillDescription: s.description,
        inputSchema: {},
      })),
    });
  }

  return results;
}

// ==================== 创建 Skill 工具实例 ====================

/**
 * Skill 配置接口（从 agent-loader 导入）
 */
import type { SkillConfig } from '@/lib/workflowchat/agent-loader';

// ==================== 声明式 Skill 工具（闭包绑定模式） ====================

/**
 * Skill 工具上下文
 * 包含执行 Skill 所需的配置和沙盒信息
 */
export interface SkillToolContext {
  /** 会话 ID */
  conversationId: string;
  /** 用户 ID */
  userId: string;
  /** Skill 配置列表 */
  skills: SkillConfig[];
}

/**
 * 创建 Skill 工具（带上下文绑定）
 * 使用闭包在创建工具时注入上下文信息
 *
 * @param context - Skill 工具上下文
 * @returns ToolSet 包含 skill 工具
 */
export function createSkillToolWithContext(context: SkillToolContext): ToolSet {
  return {
    skill: tool({
      description: '加载并执行指定的 Skill',
      inputSchema: z.object({
        skill: z.string().describe('技能名称'),
        arguments: z.string().optional().describe('传给技能的参数'),
      }),
      execute: async ({ skill: skillName, arguments: args }) => {
        "use step"; // Workflow SDK 自动重试 + 持久化

        // 1. 从闭包 context 获取 Skill 配置列表
        const skills = context.skills;

        // 2. 根据名称查找目标 Skill 配置
        const skillConfig = skills.find(s => s.name === skillName);
        if (!skillConfig) {
          return { error: `Skill '${skillName}' 不存在` };
        }

        // 2.1 检查 storagePath 是否有效
        if (!skillConfig.storagePath) {
          return { error: `Skill '${skillName}' 未配置存储路径` };
        }

        // 3. 验证 userId 是否有效
        if (!context.userId || context.userId.trim() === '') {
          return { error: '用户身份验证失败，无法执行 Skill。请先登录。' };
        }

        // 4. 从沙盒读取 SKILL.md 文件
        const { getSandboxManager } = await import('@/lib/infra/sandbox/session-manager');
        const sandboxManager = getSandboxManager();

        const skillFilePath = `${skillConfig.storagePath}/SKILL.md`;
        const content = await sandboxManager.readFile({
          sessionId: context.conversationId,
          userId: context.userId,
          relativePath: skillFilePath,
        });

        // 5. 解析 frontmatter，提取 body 内容
        const body = extractSkillBody(content);

        // 6. 替换 $ARGUMENTS 占位符为实际参数
        const finalContent = body.replace(/\$ARGUMENTS/g, args || '');

        return { content: finalContent };
      },
    }),
  };
}

/**
 * 创建统一的 Skill 工具集（无参数版本，已废弃）
 * 警告：此版本不绑定上下文，工具执行时会失败
 * 请使用 createSkillToolWithContext 代替
 *
 * @returns ToolSet 包含 skill 工具（无法执行）
 * @deprecated 请使用 createSkillToolWithContext 传入上下文
 */
export function createSkillTool(): ToolSet {
  console.warn('[Skill] createSkillTool() 无参数版本已废弃，工具无法执行。请使用 createSkillToolWithContext() 传入上下文。');
  return {
    skill: tool({
      description: '加载并执行指定的 Skill',
      inputSchema: z.object({
        skill: z.string().describe('技能名称'),
        arguments: z.string().optional().describe('传给技能的参数'),
      }),
      execute: async () => {
        return { error: 'Skill 工具未绑定上下文，无法执行。' };
      },
    }),
  };
}

/**
 * 创建 Agent 的 Skill 工具实例
 * 用于 Agent 运行时，委托给 createSkillTool() 创建统一的 skill 工具
 *
 * @param agentId - Agent ID（保留签名兼容，内部不再使用）
 * @param userId - 用户 ID（保留签名兼容，内部不再使用）
 * @param conversationId - 对话 ID（保留签名兼容，内部不再使用）
 * @param skills - 可选的 Skill 配置列表（保留签名兼容，内部不再使用）
 * @returns 工具集合（包含统一的 skill 工具）
 */
export async function createAgentSkillTools(
  agentId: string,
  userId: string,
  conversationId?: string,
  skills?: SkillConfig[]
): Promise<ToolCreateResult> {
  // 委托给 createSkillTool()，通过 experimental_context 在运行时获取 Skill 配置
  return {
    tools: createSkillTool(),
  };
}

/**
 * 注册 Skill 定义到 SkillRegistry
 * 用于动态注册 Skill
 *
 * @param skillId - Skill ID
 * @param definition - Skill 定义
 */
export function registerSkillDefinition(
  skillId: string,
  definition: SkillDefinition
): void {
  registerSkill(skillId, definition);
}

/**
 * 批量注册 Skill 定义
 *
 * @param skills - Skill ID 和定义的映射
 */
export function registerSkillDefinitions(
  skills: Map<string, SkillDefinition>
): void {
  skills.forEach((definition, skillId) => {
    registerSkill(skillId, definition);
  });
}

/**
 * 清理 Skill 相关资源
 * 用于测试或 Agent 会话结束时
 */
export function cleanupSkills(): void {
  clearSkillRegistry();
}

// ==================== Skill 元数据查询 ====================

/**
 * 获取已注册的 Skill 元数据列表
 *
 * @returns Skill 元数据列表
 */
export function getRegisteredSkillMetas(): SkillMeta[] {
  return getRegisteredSkills();
}

/**
 * 检查 Skill 是否已注册
 *
 * @param skillId - Skill ID
 * @returns 是否已注册
 */
export function isSkillRegistered(skillId: string): boolean {
  return loadSkill(skillId) !== undefined;
}

/**
 * 获取 Skill 定义
 *
 * @param skillId - Skill ID
 * @returns Skill 定义或 null
 */
export function getSkillDefinition(skillId: string): SkillDefinition | null {
  return loadSkill(skillId) || null;
}