/**
 * 对外 Skill 更新接口
 * PUT /api/v1/skills/[id]
 * 使用 API Key 鉴权更新 Skill 文件
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/infra/user/api-key";
import { getUserSkillById, updateUserSkill } from "@/lib/db/skills";
import { validateSkillFile } from "@/lib/infra/skills";
import { uploadSkillFile, calculateFileHash } from "@/lib/infra/supabase";

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
 * 更新 Skill 文件内容
 * PUT /api/v1/skills/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 验证 API Key
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) {
    return apiKeyErrorResponse(authResult);
  }

  const userId = authResult.userId;

  try {
    // 验证 Skill 存在且属于该用户
    const existing = await getUserSkillById(id);
    if (!existing || existing.user_id !== userId) {
      return errorResponse("NOT_FOUND", "Skill 不存在或无权访问", 404);
    }

    // 解析请求体
    const body = await request.json();
    const { content } = body;

    // 验证内容
    if (!content || typeof content !== "string") {
      return errorResponse("VALIDATION_ERROR", "Skill 内容不能为空", 400);
    }

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
      data: {
        id: updated?.id,
        name: updated?.name,
        description: updated?.description,
        updatedAt: updated?.updated_at,
      },
    });
  } catch (error) {
    console.error("更新 Skill 失败:", error);
    return errorResponse("INTERNAL_ERROR", "更新 Skill 失败", 500);
  }
}