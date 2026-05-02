/**
 * Skill 运行时加载器
 * 在对话开始时将 Skill 注册为沙盒会话的只读挂载
 */

import { getAgentSkillsInfo } from "@/lib/db/agents";
import { downloadSkillDirectory } from "@/lib/infra/supabase";
import { getSandboxManager } from "./session-manager";

/**
 * Skill 信息（用于加载）
 */
export interface SkillLoadInfo {
  id: string;
  name: string;
  description: string;
  storagePath: string | null;
  fileHash: string | null;
}

/**
 * 加载结果
 */
export interface LoadSkillsResult {
  success: boolean;
  loadedSkills: string[];
  skippedSkills: string[];
  errors: Array<{ skillId: string; error: string }>;
  presetPrompt: string;
}

/**
 * 获取 Agent 配置的 Skill 信息
 * 包含 fileHash 用于服务端缓存版本隔离
 */
export async function getAgentSkillInfos(agentId: string): Promise<SkillLoadInfo[]> {
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
 * 下载 Skill 目录，用于提交给 sandbox-service 做只读挂载
 * storagePath 格式: skills/{userId}/{skillName}
 */
async function downloadSkillDirectoryForMount(
  skill: SkillLoadInfo
): Promise<{ success: boolean; files?: Array<{ path: string; content: string }>; error?: string }> {
  try {
    if (!skill.storagePath) {
      return { success: false, error: "Skill 存储路径不存在" };
    }

    const pathParts = skill.storagePath.split("/");
    if (pathParts.length < 3) {
      return { success: false, error: "Skill 存储路径格式无效" };
    }

    const storageUserId = pathParts[1];
    const skillName = pathParts[2];
    const downloadResult = await downloadSkillDirectory(storageUserId, skillName);

    if (!downloadResult.success || !downloadResult.files) {
      return { success: false, error: downloadResult.error || "下载失败" };
    }

    if (downloadResult.files.length === 0) {
      return { success: false, error: "Skill 目录为空" };
    }

    return { success: true, files: downloadResult.files };
  } catch (error) {
    console.error("[Skill Loader] 下载 Skill 异常:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "下载 Skill 失败",
    };
  }
}

/**
 * 生成预置提示词
 */
function generatePresetPrompt(skills: SkillLoadInfo[]): string {
  if (skills.length === 0) {
    return "";
  }

  const skillList = skills
    .map(
      (skill) =>
        `- **${skill.name}**: ${skill.description}\n  - 文件路径: \`skills/${skill.id}/SKILL.md\``
    )
    .join("\n");

  return `## 已配置的 Skills

以下 Skills 已配置到你的环境中，位于沙盒 \`skills/\` 目录下：

${skillList}

### 如何使用 Skills

1. **读取 Skill 正文**: 使用 \`readFile\` 工具读取 \`skills/{skillId}/SKILL.md\`
2. **读取 Skill 目录下的文件**: 使用 \`readFile\` 工具读取 \`skills/{skillId}/\` 下的其他文件
3. **执行 Skill 目录下的脚本**: 使用 \`bash\` 工具执行 \`skills/{skillId}/\` 下的脚本文件

在执行 Skill 相关操作前，建议先读取 Skill 正文了解其具体功能和用法。`;
}

/**
 * 加载 Agent 配置的 Skills 到沙盒
 * @param userId 用户 ID
 * @param agentId Agent ID
 * @param sessionId 沙盒会话 ID（通常为 conversationId）
 * @returns 加载结果
 */
export async function loadSkillsToSandbox(
  userId: string,
  agentId: string,
  sessionId: string
): Promise<LoadSkillsResult> {
  const result: LoadSkillsResult = {
    success: true,
    loadedSkills: [],
    skippedSkills: [],
    errors: [],
    presetPrompt: "",
  };

  try {
    const skills = await getAgentSkillInfos(agentId);

    if (skills.length === 0) {
      return result;
    }

    const skillsToMount: Array<{
      id: string;
      fileHash: string | null;
      files: Array<{ path: string; content: string }>;
    }> = [];

    for (const skill of skills) {
      const downloadResult = await downloadSkillDirectoryForMount(skill);

      if (downloadResult.success && downloadResult.files) {
        skillsToMount.push({
          id: skill.id,
          fileHash: skill.fileHash,
          files: downloadResult.files,
        });
      } else {
        result.errors.push({
          skillId: skill.id,
          error: downloadResult.error || "未知错误",
        });
      }
    }

    if (skillsToMount.length > 0) {
      const sandbox = getSandboxManager();
      const mountedSkills = await sandbox.mountSkills({
        sessionId,
        userId,
        skills: skillsToMount,
      });
      result.loadedSkills.push(...mountedSkills);
    }

    const availableSkills = skills.filter(
      (skill) =>
        result.loadedSkills.includes(skill.id) || result.skippedSkills.includes(skill.id)
    );
    result.presetPrompt = generatePresetPrompt(availableSkills);

    if (result.errors.length === skills.length) {
      result.success = false;
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      skillId: "unknown",
      error: error instanceof Error ? error.message : "加载失败",
    });
  }

  return result;
}
