/**
 * Skill 单个操作 API
 * 提供详情、更新、删除功能
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import {
  getUserSkillById,
  updateUserSkill,
  deleteUserSkill,
  getSkillAgents,
  getUserSkillsByUserId,
} from "@/lib/db/skills";
import { validateSkillFile } from "@/lib/utils/skill-validator";
import { uploadSkillFile, calculateFileHash, deleteSkillDirectory, downloadSkillDirectory } from "@/lib/supabase/storage";

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取 Skill 详情
 * GET /api/skills/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  try {
    // 获取 Skill 详情
    const skill = await getUserSkillById(id);
    if (!skill) {
      return errorResponse("NOT_FOUND", "Skill 不存在", 404);
    }

    // 验证权限（仅创建者可查看）
    if (skill.user_id !== userId) {
      return errorResponse("FORBIDDEN", "无权访问此 Skill", 403);
    }

    // 获取关联的 Agent 列表
    const agentIds = await getSkillAgents(id);

    // 下载 Skill 目录内容（用于展示）
    let files: Array<{ path: string; content: string }> = [];
    if (skill.storage_path) {
      const downloadResult = await downloadSkillDirectory(skill.user_id, skill.name);
      if (downloadResult.success && downloadResult.files) {
        files = downloadResult.files;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        metadata: skill.metadata,
        files,  // 文件列表
        linkedAgents: agentIds,
        createdAt: skill.created_at,
        updatedAt: skill.updated_at,
      },
    });
  } catch (error) {
    console.error("获取 Skill 详情失败:", error);
    return errorResponse("INTERNAL_ERROR", "获取 Skill 详情失败", 500);
  }
}

/**
 * 更新 Skill
 * PUT /api/skills/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  try {
    // 验证 Skill 存在且属于该用户
    const existing = await getUserSkillById(id);
    if (!existing || existing.user_id !== userId) {
      return errorResponse("NOT_FOUND", "Skill 不存在或无权访问", 404);
    }

    // 解析请求体（FormData 格式）
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse("VALIDATION_ERROR", "请上传 Skill 文件", 400);
    }

    // 读取文件内容
    const content = await file.text();

    // 校验 Skill 文件格式
    const validation = validateSkillFile(content);
    if (!validation.valid) {
      return errorResponse(
        "UNPROCESSABLE_ENTITY",
        "Skill 文件校验失败",
        422,
        { reason: validation.error }
      );
    }

    // 检查名称是否与其他 Skill 重复
    const skills = await getUserSkillsByUserId(userId);
    const nameConflict = skills.find(
      (s) => s.name === validation.name && s.id !== id
    );
    if (nameConflict) {
      return errorResponse("CONFLICT", "Skill 名称已存在", 409, {
        existingName: validation.name,
      });
    }

    // 计算文件哈希
    const fileHash = await calculateFileHash(content);

    // 上传新文件到 Supabase Storage
    const uploadResult = await uploadSkillFile(userId, id, content);
    if (!uploadResult.success) {
      return errorResponse("INTERNAL_ERROR", uploadResult.error || "文件上传失败", 500);
    }

    // 更新 Skill 记录
    const updated = await updateUserSkill(userId, id, {
      name: validation.name,
      description: validation.description,
      metadata: validation.metadata,
      storagePath: uploadResult.path,
      fileHash,
      fileSize: content.length,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("更新 Skill 失败:", error);
    return errorResponse("INTERNAL_ERROR", "更新 Skill 失败", 500);
  }
}

/**
 * 删除 Skill
 * DELETE /api/skills/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  try {
    // 获取 Skill 详情
    const skill = await getUserSkillById(id);
    if (!skill || skill.user_id !== userId) {
      return errorResponse("NOT_FOUND", "Skill 不存在或无权访问", 404);
    }

    // 检查关联 Agent 数量
    const agentIds = await getSkillAgents(id);
    if (agentIds.length > 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        `该 Skill 已关联 ${agentIds.length} 个 Agent，请先移除关联后再删除`,
        400,
        { linkedAgents: agentIds }
      );
    }

    // 删除 Supabase Storage 中的文件
    await deleteSkillDirectory(userId, id);

    // 删除数据库记录
    const deleted = await deleteUserSkill(userId, id);

    return NextResponse.json({
      success: deleted,
    });
  } catch (error) {
    console.error("删除 Skill 失败:", error);
    return errorResponse("INTERNAL_ERROR", "删除 Skill 失败", 500);
  }
}