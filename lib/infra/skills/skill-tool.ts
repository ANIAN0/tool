/**
 * Skill 工具实现
 * 将 Skill 注册为 Agent 可用的 Tool
 *
 * 设计目标：
 * - 提供统一的 execute_skill 工具接口
 * - 支持动态 Skill 加载和执行
 * - 提供完善的错误处理机制
 */

import { z } from 'zod';
import type { ToolDefinition } from '@/lib/infra/tools/registry';
import type {
  SkillToolInput,
  SkillToolResult,
  SkillExecutionContext,
  SkillErrorType,
} from './types';
import { executeSkill, loadSkill } from './loader';
import type { SkillDefinition } from './core-types';

// ==================== 参数 Schema ====================

/**
 * execute_skill 工具参数 Schema
 */
export const executeSkillSchema = z.object({
  skillId: z.string().describe('要执行的 Skill ID'),
  input: z.string().describe('JSON 字符串形式的 Skill 输入参数'),
});

// ==================== 错误处理 ====================

/**
 * 创建错误结果
 * @param errorType - 错误类型
 * @param message - 错误消息
 * @returns SkillToolResult
 */
function createErrorResult(
  errorType: SkillErrorType,
  message: string
): SkillToolResult {
  return {
    success: false,
    error: message,
    errorType,
    logs: [],
  };
}

/**
 * 解析 JSON 输入
 * @param input - JSON 字符串
 * @returns 解析后的对象或错误结果
 */
function parseInput(input: string): unknown | SkillToolResult {
  // 空输入默认为空对象
  if (!input || input.trim() === '') {
    return {};
  }

  try {
    return JSON.parse(input);
  } catch (e) {
    return createErrorResult('INVALID_INPUT', 'Invalid JSON input');
  }
}

// ==================== SkillTool 实现 ====================

/**
 * 创建 execute_skill 工具定义
 * @param context - Skill 执行上下文
 * @returns ToolDefinition
 */
export function createSkillToolDefinition(
  context: SkillExecutionContext
): ToolDefinition {
  return {
    name: 'execute_skill',
    description: '执行指定的 Skill，传入 JSON 格式的输入参数',
    create: () => ({
      tools: {
        execute_skill: {
          description: '执行指定的 Skill。Skill 是一组预定义的能力，可以通过输入参数进行配置和执行。',
          inputSchema: executeSkillSchema,
          execute: async (params: SkillToolInput): Promise<SkillToolResult> => {
            // 验证必要参数
            if (!params.skillId) {
              return createErrorResult('SKILL_NOT_FOUND', 'Skill ID is required');
            }

            // 解析输入参数
            const parsedInput = parseInput(params.input);
            if (typeof parsedInput === 'object' && 'success' in parsedInput && parsedInput.success === false) {
              return parsedInput as SkillToolResult;
            }

            // 加载 Skill 定义
            const skill = loadSkill(params.skillId);
            if (!skill) {
              return createErrorResult('SKILL_NOT_FOUND', `Skill not found: ${params.skillId}`);
            }

            // 执行 Skill
            try {
              const result = await executeSkill(
                params.skillId,
                parsedInput,
                context
              );

              // 转换为工具返回格式
              // 如果执行失败，设置对应的错误类型
              const errorType: SkillErrorType | undefined = !result.success
                ? 'SKILL_EXECUTE_ERROR'
                : undefined;

              return {
                success: result.success,
                data: result.data,
                error: result.error,
                errorType,
                logs: result.logs || [],
              };
            } catch (e) {
              const errorMessage = e instanceof Error ? e.message : 'Unknown error';
              return createErrorResult('SKILL_EXECUTE_ERROR', `Skill execution failed: ${errorMessage}`);
            }
          },
        },
      },
    }),
    metadata: {
      type: 'skill',
      requiresContext: true,
    },
  };
}

/**
 * 创建指定 Skill 的专属工具定义
 * 将单个 Skill 注册为独立的工具
 *
 * @param skillId - Skill ID
 * @param context - Skill 执行上下文
 * @returns ToolDefinition 或 null（Skill 不存在时）
 */
export function createSpecificSkillToolDefinition(
  skillId: string,
  context: SkillExecutionContext
): ToolDefinition | null {
  // 加载 Skill 定义
  const skill = loadSkill(skillId);
  if (!skill) {
    return null;
  }

  // 构建输入 Schema（基于 Skill 的 inputSchema）
  const inputSchema = z.object({
    input: z.string().optional().describe('JSON 字符串形式的 Skill 输入参数'),
  });

  return {
    name: `skill_${skillId}`,
    description: skill.metadata.description || `执行 Skill: ${skill.metadata.name}`,
    create: () => ({
      tools: {
        [`skill_${skillId}`]: {
          description: skill.metadata.description || `执行 Skill: ${skill.metadata.name}`,
          inputSchema: inputSchema,
          execute: async (params: { input?: string }): Promise<SkillToolResult> => {
            // 解析输入参数
            const inputStr = params.input || '';
            const parsedInput = parseInput(inputStr);
            if (typeof parsedInput === 'object' && 'success' in parsedInput && parsedInput.success === false) {
              return parsedInput as SkillToolResult;
            }

            // 执行 Skill
            try {
              const result = await executeSkill(
                skillId,
                parsedInput,
                context
              );

              const errorType: SkillErrorType | undefined = !result.success
                ? 'SKILL_EXECUTE_ERROR'
                : undefined;

              return {
                success: result.success,
                data: result.data,
                error: result.error,
                errorType,
                logs: result.logs || [],
              };
            } catch (e) {
              const errorMessage = e instanceof Error ? e.message : 'Unknown error';
              return createErrorResult('SKILL_EXECUTE_ERROR', `Skill execution failed: ${errorMessage}`);
            }
          },
        },
      },
    }),
    metadata: {
      type: 'skill',
      skillId,
      skillName: skill.metadata.name,
    },
  };
}

/**
 * 批量创建 Skill 工具定义
 * 将多个 Skill 注册为独立的工具
 *
 * @param skillIds - Skill ID 列表
 * @param context - Skill 执行上下文
 * @returns 工具定义列表
 */
export function createSkillToolDefinitions(
  skillIds: string[],
  context: SkillExecutionContext
): ToolDefinition[] {
  const definitions: ToolDefinition[] = [];

  // 首先添加通用的 execute_skill 工具
  definitions.push(createSkillToolDefinition(context));

  // 为每个 Skill 创建专属工具
  for (const skillId of skillIds) {
    const definition = createSpecificSkillToolDefinition(skillId, context);
    if (definition) {
      definitions.push(definition);
    }
  }

  return definitions;
}

/**
 * 从 Skill 定义创建工具定义
 * 直接使用 SkillDefinition 创建工具
 *
 * @param skillDef - Skill 定义
 * @param context - Skill 执行上下文
 * @returns ToolDefinition
 */
export function createToolFromSkillDefinition(
  skillDef: SkillDefinition,
  context: SkillExecutionContext
): ToolDefinition {
  return {
    name: `skill_${skillDef.metadata.name.toLowerCase().replace(/\s+/g, '_')}`,
    description: skillDef.metadata.description,
    create: () => ({
      tools: {
        [`skill_${skillDef.metadata.name.toLowerCase().replace(/\s+/g, '_')}`]: {
          description: skillDef.metadata.description,
          inputSchema: z.object({
            input: z.string().optional().describe('JSON 字符串形式的 Skill 输入参数'),
          }),
          execute: async (params: { input?: string }): Promise<SkillToolResult> => {
            const inputStr = params.input || '';
            const parsedInput = parseInput(inputStr);
            if (typeof parsedInput === 'object' && 'success' in parsedInput && parsedInput.success === false) {
              return parsedInput as SkillToolResult;
            }

            try {
              const result = await skillDef.execute(parsedInput, context);
              const errorType: SkillErrorType | undefined = !result.success
                ? 'SKILL_EXECUTE_ERROR'
                : undefined;
              return {
                success: result.success,
                data: result.data,
                error: result.error,
                errorType,
                logs: result.logs || [],
              };
            } catch (e) {
              const errorMessage = e instanceof Error ? e.message : 'Unknown error';
              return createErrorResult('SKILL_EXECUTE_ERROR', `Skill execution failed: ${errorMessage}`);
            }
          },
        },
      },
    }),
    metadata: {
      type: 'skill',
      skillName: skillDef.metadata.name,
      version: skillDef.metadata.version,
    },
  };
}