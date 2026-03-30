/**
 * Skill 文件校验工具
 * 验证 Skill 文件格式，解析 frontmatter 元数据
 */

import matter from "gray-matter";
import type { SkillValidationResult } from "@/lib/db/schema";

/**
 * Skill 目录校验结果
 */
export interface SkillDirectoryValidation {
  valid: boolean;
  name?: string;
  description?: string;
  metadata?: string;
  files?: Array<{ path: string; content: string }>;
  totalSize?: number;
  error?: string;
}

/**
 * Skill 文件约束配置
 */
const SKILL_CONSTRAINTS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MIN_LENGTH: 1,
  DESCRIPTION_MAX_LENGTH: 200,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 单文件大小限制 5MB
  MAX_TOTAL_SIZE: 5 * 1024 * 1024, // 目录总大小限制 5MB
} as const;

/**
 * 校验 Skill 文件内容
 * @param content Skill 文件内容（Markdown 格式）
 * @returns 校验结果
 */
export function validateSkillFile(content: string): SkillValidationResult {
  // 检查文件大小
  if (content.length > SKILL_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Skill 文件大小超过限制（最大 ${SKILL_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB）`,
    };
  }

  try {
    // 使用 gray-matter 解析 frontmatter
    const parsed = matter(content);

    // 检查 frontmatter 是否存在
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      return {
        valid: false,
        error: "Skill 文件缺少有效的 frontmatter",
      };
    }

    const { name, description } = parsed.data;

    // 校验 name 字段
    if (!name || typeof name !== "string") {
      return {
        valid: false,
        error: "Skill name 为必填项",
      };
    }

    const trimmedName = name.trim();
    if (trimmedName.length < SKILL_CONSTRAINTS.NAME_MIN_LENGTH) {
      return {
        valid: false,
        error: `Skill name 长度不能为空`,
      };
    }

    if (trimmedName.length > SKILL_CONSTRAINTS.NAME_MAX_LENGTH) {
      return {
        valid: false,
        error: `Skill name 长度限制 ${SKILL_CONSTRAINTS.NAME_MAX_LENGTH} 字符`,
      };
    }

    // 校验 description 字段
    if (!description || typeof description !== "string") {
      return {
        valid: false,
        error: "Skill description 为必填项",
      };
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length < SKILL_CONSTRAINTS.DESCRIPTION_MIN_LENGTH) {
      return {
        valid: false,
        error: "Skill description 不能为空",
      };
    }

    if (trimmedDescription.length > SKILL_CONSTRAINTS.DESCRIPTION_MAX_LENGTH) {
      return {
        valid: false,
        error: `Skill description 长度限制 ${SKILL_CONSTRAINTS.DESCRIPTION_MAX_LENGTH} 字符`,
      };
    }

    // 返回校验成功结果
    return {
      valid: true,
      name: trimmedName,
      description: trimmedDescription,
      metadata: JSON.stringify(parsed.data),
    };
  } catch (error) {
    return {
      valid: false,
      error: "Skill 文件格式解析失败，请检查 YAML frontmatter 格式",
    };
  }
}

/**
 * 从 Skill 内容提取元数据
 * @param content Skill 文件内容
 * @returns 元数据对象
 */
export function extractSkillMetadata(content: string): Record<string, unknown> | null {
  try {
    const parsed = matter(content);
    return parsed.data || null;
  } catch {
    return null;
  }
}

/**
 * 获取 Skill 正文内容（不含 frontmatter）
 * @param content Skill 文件内容
 * @returns 正文内容
 */
export function extractSkillBody(content: string): string {
  try {
    const parsed = matter(content);
    return parsed.content.trim();
  } catch {
    return content;
  }
}

/**
 * 校验 Skill 目录
 * @param files 文件映射（相对路径 -> 内容）
 * @returns 校验结果
 */
export function validateSkillDirectory(
  files: Map<string, string>
): SkillDirectoryValidation {
  // 1. 检查根目录是否有 SKILL.md 文件
  const skillMdPath = "SKILL.md";
  if (!files.has(skillMdPath)) {
    return {
      valid: false,
      error: "目录缺少 SKILL.md 文件",
    };
  }

  // 2. 获取 SKILL.md 内容
  const skillMdContent = files.get(skillMdPath)!;

  // 3. 使用 validateSkillFile 校验 SKILL.md 内容
  const skillValidation = validateSkillFile(skillMdContent);
  if (!skillValidation.valid) {
    return {
      valid: false,
      error: skillValidation.error,
    };
  }

  // 4. 计算目录总大小
  let totalSize = 0;
  const fileList: Array<{ path: string; content: string }> = [];

  for (const [path, content] of files.entries()) {
    totalSize += content.length;
    fileList.push({ path, content });
  }

  // 5. 检查总大小限制（5MB）
  if (totalSize > SKILL_CONSTRAINTS.MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `目录总大小超过限制（最大 ${SKILL_CONSTRAINTS.MAX_TOTAL_SIZE / 1024 / 1024}MB）`,
    };
  }

  // 6. 返回校验成功结果
  return {
    valid: true,
    name: skillValidation.name,
    description: skillValidation.description,
    metadata: skillValidation.metadata,
    files: fileList,
    totalSize,
  };
}