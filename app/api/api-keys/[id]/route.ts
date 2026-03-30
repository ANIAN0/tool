/**
 * API Key 单个操作 API
 * 提供删除功能
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { deleteUserApiKey, getUserApiKeyById } from "@/lib/db/api-keys";

/**
 * 统一错误响应格式
 */
function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 删除 API Key
 * DELETE /api/api-keys/[id]
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
    // 验证 API Key 存在且属于该用户
    const existing = await getUserApiKeyById(userId, id);
    if (!existing) {
      return errorResponse("NOT_FOUND", "API Key 不存在", 404);
    }

    // 删除 API Key
    const deleted = await deleteUserApiKey(userId, id);

    return NextResponse.json({
      success: deleted,
    });
  } catch (error) {
    console.error("删除 API Key 失败:", error);
    return errorResponse("INTERNAL_ERROR", "删除 API Key 失败", 500);
  }
}