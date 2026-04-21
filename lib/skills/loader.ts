/**
 * Skill 加载模块
 * 负责按需加载和执行 Skill
 */

import type { SkillDefinition, SkillContext, SkillResult, SkillMeta } from './types';

/**
 * Skill 注册表（内存缓存）
 */
const skillRegistry = new Map<string, SkillDefinition>();

/**
 * 注册 Skill
 * @param skillId - Skill ID
 * @param definition - Skill 定义
 */
export function registerSkill(skillId: string, definition: SkillDefinition): void {
  skillRegistry.set(skillId, definition);
  console.log(`Skill 已注册：${skillId} (${definition.metadata.name})`);
}

/**
 * 加载 Skill（从注册表获取）
 * @param skillId - Skill ID
 * @returns Skill 定义（如果存在）
 */
export function loadSkill(skillId: string): SkillDefinition | undefined {
  return skillRegistry.get(skillId);
}

/**
 * 批量加载 Skills
 * @param skillIds - Skill ID 列表
 * @returns 加载成功的 Skill 定义列表
 */
export function loadSkills(skillIds: string[]): SkillDefinition[] {
  const loaded: SkillDefinition[] = [];
  
  for (const skillId of skillIds) {
    const skill = loadSkill(skillId);
    if (skill) {
      loaded.push(skill);
    } else {
      console.warn(`Skill 未找到：${skillId}`);
    }
  }
  
  return loaded;
}

/**
 * 执行 Skill
 * @param skillId - Skill ID
 * @param input - 输入参数
 * @param context - 执行上下文
 * @returns 执行结果
 */
export async function executeSkill<TInput = unknown, TOutput = unknown>(
  skillId: string,
  input: TInput,
  context: SkillContext
): Promise<SkillResult<TOutput>> {
  const skill = loadSkill(skillId);
  
  if (!skill) {
    return {
      success: false,
      error: `Skill 未找到：${skillId}`,
      logs: [],
    } as SkillResult<TOutput>;
  }

  try {
    const result = await skill.execute(input, context) as SkillResult<TOutput>;
    return result;
  } catch (error) {
    console.error(`Skill 执行失败 [${skillId}]:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      logs: [],
    } as SkillResult<TOutput>;
  }
}

/**
 * 获取已注册 Skill 列表
 * @returns Skill 元数据列表
 */
export function getRegisteredSkills(): SkillMeta[] {
  const skills: SkillMeta[] = [];
  
  for (const [id, definition] of skillRegistry.entries()) {
    skills.push({
      id,
      name: definition.metadata.name,
      description: definition.metadata.description,
      version: definition.metadata.version,
      author: definition.metadata.author,
      filePath: '', // 动态注册的 Skill 没有文件路径
    });
  }
  
  return skills;
}

/**
 * 清除 Skill 注册表（用于测试）
 */
export function clearSkillRegistry(): void {
  skillRegistry.clear();
}
