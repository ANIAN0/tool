/**
 * Skill 发现模块
 * 负责扫描 Skill 目录，解析 frontmatter，返回元数据
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SkillMeta, SkillMetadata } from './core-types';

/**
 * 解析 frontmatter
 * @param content - 文件内容
 * @returns 解析后的元数据
 */
function parseFrontmatter(content: string): Partial<SkillMetadata> {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {};
  }

  const frontmatter = match[1];
  const metadata: Partial<SkillMetadata> = {};

  // 简单解析 YAML 格式的 frontmatter
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      const normalizedKey = key.trim() as keyof SkillMetadata;

      if (normalizedKey === 'permissions' || normalizedKey === 'dependencies') {
        // 解析数组
        metadata[normalizedKey] = value.split(',').map((v) => v.trim());
      } else {
        metadata[normalizedKey] = value as never;
      }
    }
  }

  return metadata;
}

/**
 * 扫描 Skill 目录，发现所有可用的 Skill
 * @param skillsDir - Skill 目录路径
 * @returns Skill 元数据列表
 */
export async function discoverSkills(skillsDir: string): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = [];

  try {
    // 检查目录是否存在
    if (!fs.existsSync(skillsDir)) {
      console.log(`Skill 目录不存在：${skillsDir}`);
      return skills;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // 每个子目录是一个 Skill
        const skillDir = path.join(skillsDir, entry.name);
        const indexFile = path.join(skillDir, 'index.ts');
        const indexJsFile = path.join(skillDir, 'index.js');

        // 检查是否有 index.ts 或 index.js
        if (fs.existsSync(indexFile) || fs.existsSync(indexJsFile)) {
          // 尝试读取 frontmatter（从 README.md 或 index.ts）
          let metadata: Partial<SkillMetadata> = {};

          const readmePath = path.join(skillDir, 'README.md');
          if (fs.existsSync(readmePath)) {
            const readmeContent = fs.readFileSync(readmePath, 'utf-8');
            metadata = parseFrontmatter(readmeContent);
          } else if (fs.existsSync(indexFile)) {
            const indexContent = fs.readFileSync(indexFile, 'utf-8');
            metadata = parseFrontmatter(indexContent);
          }

          if (metadata.name && metadata.description) {
            skills.push({
              id: entry.name,
              name: metadata.name,
              description: metadata.description,
              version: metadata.version,
              author: metadata.author,
              filePath: skillDir,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Skill 发现失败:', error);
  }

  return skills;
}

/**
 * 验证 Skill 元数据是否完整
 * @param metadata - 待验证的元数据
 * @returns 验证结果
 */
export function validateSkillMetadata(metadata: Partial<SkillMetadata>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!metadata.name) {
    errors.push('缺少 Skill 名称 (name)');
  }

  if (!metadata.description) {
    errors.push('缺少 Skill 描述 (description)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}