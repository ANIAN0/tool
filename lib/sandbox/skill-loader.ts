/**
 * Skill 运行时加载器
 * 在对话开始时将 Skill 文件加载到沙盒工作区
 */

import { getAgentSkillsInfo } from "@/lib/db/agents";
import { downloadSkillDirectory } from "@/lib/supabase/storage";
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
  loadedSkills: string[];    // 成功加载的 skillId 列表
  skippedSkills: string[];   // 跳过的 skillId 列表（已是最新）
  errors: Array<{ skillId: string; error: string }>;
  presetPrompt: string;      // 生成的预置提示词
}

/**
 * 获取 Agent 配置的 Skill 信息
 * 包含 fileHash 用于版本检测
 */
export async function getAgentSkillInfos(agentId: string): Promise<SkillLoadInfo[]> {
  // 获取 Agent 关联的 Skills（包含 fileHash）
  const skills = await getAgentSkillsInfo(agentId);

  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    storagePath: skill.storagePath,
    // fileHash 来自数据库，用于检测 Skill 文件版本变化
    fileHash: skill.fileHash,
  }));
}

/**
 * 检查沙盒中的 Skill 是否存在
 * 简化版本检测：只要目录存在且有文件就跳过下载
 * 注意：fileHash 用于未来可能的精确版本检测
 */
async function isSkillUpToDate(
  sessionId: string,
  userId: string,
  skillId: string,
  expectedHash: string | null
): Promise<boolean> {
  console.log(`[Skill Loader] 检查 Skill 是否已存在: sessionId=${sessionId}, userId=${userId}, skillId=${skillId}`);
  try {
    const sandbox = getSandboxManager();

    // 使用 test 命令检查目录是否存在且有文件
    // 注意：nsjail rootfs 中没有 head 命令，/dev/null 是只读的
    // 所以使用 test -d 检查目录，test -f 检查关键文件
    console.log(`[Skill Loader] 执行检查命令: test -d skills/${skillId} && test -f skills/${skillId}/SKILL.md`);
    const result = await sandbox.exec({
      sessionId,
      userId,
      // 使用 test 命令检查关键文件 SKILL.md 是否存在
      code: `test -d skills/${skillId} && test -f skills/${skillId}/SKILL.md && echo "exists"`,
      language: "bash",
    });

    console.log(`[Skill Loader] 检查结果: stdout="${result.stdout.trim()}", stderr="${result.stderr.trim()}", exitCode=${result.exitCode}`);

    // 如果输出包含 "exists"，认为 Skill 已加载
    const isUpToDate = result.stdout.trim() === "exists";
    console.log(`[Skill Loader] Skill ${skillId} 是否已是最新: ${isUpToDate}`);
    return isUpToDate;
  } catch (error) {
    console.error(`[Skill Loader] 检查 Skill ${skillId} 是否存在时发生异常:`, error);
    return false;
  }
}

/**
 * 将 Skill 目录下载并写入沙盒
 * storagePath 格式: skills/{userId}/{skillName}
 */
async function downloadSkillDirectoryToSandbox(
  sessionId: string,
  userId: string,
  skill: SkillLoadInfo
): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查存储路径是否存在
    if (!skill.storagePath) {
      console.log(`[Skill Loader] Skill ${skill.id} 存储路径不存在`);
      return { success: false, error: "Skill 存储路径不存在" };
    }

    // 从 storagePath 提取 userId 和 skillName
    // storagePath 格式: skills/{userId}/{skillName}
    const pathParts = skill.storagePath.split('/');
    if (pathParts.length < 3) {
      console.log(`[Skill Loader] Skill ${skill.id} 存储路径格式无效: ${skill.storagePath}`);
      return { success: false, error: "Skill 存储路径格式无效" };
    }
    const storageUserId = pathParts[1];
    const skillName = pathParts[2];

    console.log(`[Skill Loader] 下载 Skill 目录: userId=${storageUserId}, skillName=${skillName}`);

    // 使用 downloadSkillDirectory 下载整个目录
    const downloadResult = await downloadSkillDirectory(storageUserId, skillName);
    console.log(`[Skill Loader] 下载结果: success=${downloadResult.success}, files=${downloadResult.files?.length || 0}, error=${downloadResult.error}`);

    if (!downloadResult.success || !downloadResult.files) {
      return { success: false, error: downloadResult.error || "下载失败" };
    }

    if (downloadResult.files.length === 0) {
      console.log(`[Skill Loader] Skill ${skill.id} 目录为空，没有文件可写入`);
      return { success: false, error: "Skill 目录为空" };
    }

    const sandbox = getSandboxManager();

    // 创建 Skill 目录结构（包含子目录）
    // 使用 -m 777 设置权限，确保后续 writeFile 可写入
    // 注意：沙盒内进程以 nobody(65534) 身份运行，创建的目录需要 777 权限
    // 这样宿主机上的 sandbox-service 才能修改这些目录
    console.log(`[Skill Loader] 创建目录: skills/${skill.id}`);
    await sandbox.exec({
      sessionId,
      userId,
      code: `mkdir -p -m 777 skills/${skill.id}`,
      language: "bash",
    });

    // 遍历所有文件并写入沙盒
    console.log(`[Skill Loader] 开始写入 ${downloadResult.files.length} 个文件到沙盒`);
    for (const file of downloadResult.files) {
      const filePath = `skills/${skill.id}/${file.path}`;
      console.log(`[Skill Loader] 写入文件: ${filePath} (${file.content.length} bytes)`);

      try {
        await sandbox.writeFile({
          sessionId,
          userId,
          relativePath: filePath,
          content: file.content,
        });
        console.log(`[Skill Loader] 文件写入成功: ${filePath}`);
      } catch (writeError) {
        console.error(`[Skill Loader] 文件写入失败: ${filePath}`, writeError);
        return { success: false, error: `写入文件失败: ${file.path} - ${writeError instanceof Error ? writeError.message : String(writeError)}` };
      }
    }

    console.log(`[Skill Loader] Skill ${skill.id} 所有文件写入完成`);
    return { success: true };
  } catch (error) {
    console.error(`[Skill Loader] 写入沙盒异常:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "写入沙盒失败",
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
        `- **${skill.name}**: ${skill.description}\n  - 文件路径: \`skills/${skill.id}/skill.md\``
    )
    .join("\n");

  return `## 已配置的 Skills

以下 Skills 已配置到你的环境中，位于沙盒 \`skills/\` 目录下：

${skillList}

### 如何使用 Skills

1. **读取 Skill 正文**: 使用 \`readFile\` 工具读取 \`skills/{skillId}/skill.md\`
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
    // 获取 Agent 配置的 Skills
    const skills = await getAgentSkillInfos(agentId);

    if (skills.length === 0) {
      return result;
    }

    // 逐个加载 Skill
    for (const skill of skills) {
      // 检查是否已是最新
      const isUpToDate = await isSkillUpToDate(
        sessionId,
        userId,
        skill.id,
        skill.fileHash
      );

      if (isUpToDate) {
        result.skippedSkills.push(skill.id);
        continue;
      }

      // 下载目录并写入沙盒
      const downloadResult = await downloadSkillDirectoryToSandbox(sessionId, userId, skill);

      if (downloadResult.success) {
        result.loadedSkills.push(skill.id);
      } else {
        result.errors.push({
          skillId: skill.id,
          error: downloadResult.error || "未知错误",
        });
      }
    }

    // 生成预置提示词（包含成功加载和跳过的 Skill）
    const availableSkills = skills.filter(
      (s) =>
        result.loadedSkills.includes(s.id) || result.skippedSkills.includes(s.id)
    );
    result.presetPrompt = generatePresetPrompt(availableSkills);

    // 如果所有 Skill 都加载失败，标记为失败
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