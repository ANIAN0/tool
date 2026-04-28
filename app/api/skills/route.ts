/**
 * Skill 管理 API
 * 提供 Skill 的列表获取和创建功能
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isRegisteredUser } from "@/lib/infra/user/middleware";
import {
  getUserSkillsByUserId,
  createUserSkill,
  isSkillNameExists,
} from "@/lib/db/skills";
import { validateSkillDirectory } from "@/lib/infra/skills";
import { uploadSkillDirectory, calculateDirectoryHash } from "@/lib/infra/supabase";

/**
 * 统一错误响应格式
 */
function errorResponse(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

/**
 * 获取 Skill 列表
 * GET /api/skills
 */
export async function GET(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  try {
    // 获取用户的 Skill 列表（含关联 Agent 数量）
    const skills = await getUserSkillsByUserId(userId);

    return NextResponse.json({
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        metadata: skill.metadata,
        agentCount: skill.agentCount,
        fileCount: skill.file_count ?? 1,  // 文件数量（从数据库获取，默认 1）
        totalSize: skill.file_size ?? 0,   // 目录总大小（字节）
        createdAt: skill.created_at,
        updatedAt: skill.updated_at,
      })),
    });
  } catch (error) {
    console.error("获取 Skill 列表失败:", error);
    return errorResponse("INTERNAL_ERROR", "获取 Skill 列表失败", 500);
  }
}

/**
 * 创建新 Skill
 * POST /api/skills
 */
export async function POST(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  // 验证用户是否为注册用户（非匿名）
  const isRegistered = await isRegisteredUser(userId);
  if (!isRegistered) {
    return errorResponse("FORBIDDEN", "仅支持注册用户创建 Skill", 403);
  }

  try {
    // 解析请求体（FormData 格式）
    const formData = await request.formData();

    // 获取文件列表和对应的相对路径
    const files = formData.getAll("files") as File[];
    const pathsJson = formData.get("paths") as string;
    // 解析路径 JSON，如果没有提供路径则使用文件名作为路径
    const paths: string[] = pathsJson ? JSON.parse(pathsJson) : files.map((f) => f.name);

    // 验证至少有一个文件
    if (files.length === 0) {
      return errorResponse("VALIDATION_ERROR", "请上传 Skill 目录", 400);
    }

    // 验证文件和路径数量匹配
    if (files.length !== paths.length) {
      return errorResponse("VALIDATION_ERROR", "文件和路径数量不匹配", 400);
    }

    // 构建文件映射（相对路径 -> 内容）
    // 去除路径中的目录名前缀（webkitRelativePath 格式为 "目录名/文件名"）
    const fileMap = new Map<string, string>();
    for (let i = 0; i < files.length; i++) {
      // 读取每个文件的内容
      const content = await files[i].text();
      // 处理路径：去除目录名前缀，只保留相对路径
      // 例如：从 "memos-skill/SKILL.md" 提取 "SKILL.md"
      // 或者从 "memos-skill/subdir/file.ts" 提取 "subdir/file.ts"
      const normalizedPath = paths[i].split('/').slice(1).join('/');
      fileMap.set(normalizedPath, content);
    }

    // 校验 Skill 目录（检查 SKILL.md 等）
    const validation = validateSkillDirectory(fileMap);
    if (!validation.valid) {
      return errorResponse(
        "UNPROCESSABLE_ENTITY",
        validation.error || "Skill 目录校验失败",
        422
      );
    }

    // 检查 Skill 名称是否重复
    const nameExists = await isSkillNameExists(userId, validation.name!);
    if (nameExists) {
      return errorResponse("CONFLICT", "Skill 名称已存在", 409, {
        existingName: validation.name,
      });
    }

    // 计算目录整体哈希
    const fileHash = await calculateDirectoryHash(validation.files!);

    // 上传目录到 Supabase Storage
    const uploadResult = await uploadSkillDirectory(
      userId,
      validation.name!,
      validation.files!
    );
    if (!uploadResult.success) {
      return errorResponse("INTERNAL_ERROR", uploadResult.error || "目录上传失败", 500);
    }

    // 创建 Skill 记录（使用 name 作为 ID）
    const skill = await createUserSkill({
      id: validation.name!, // 使用 name 作为 ID
      userId,
      name: validation.name!,
      description: validation.description!,
      metadata: validation.metadata,
      storagePath: `skills/${userId}/${validation.name!}`, // 目录路径
      fileHash,
      fileSize: validation.totalSize,
      fileCount: validation.files!.length,  // 文件数量
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          uploadedFiles: uploadResult.uploadedCount,
          createdAt: skill.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("创建 Skill 失败:", error);
    // 处理 JSON 解析错误
    if (error instanceof SyntaxError) {
      return errorResponse("VALIDATION_ERROR", "路径 JSON 解析失败", 400);
    }
    return errorResponse("INTERNAL_ERROR", "创建 Skill 失败", 500);
  }
}