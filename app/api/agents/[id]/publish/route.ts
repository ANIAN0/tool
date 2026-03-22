/**
 * Agent公开状态API路由
 * PATCH: 切换Agent公开/私有状态（仅创建者）
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { setAgentPublic, isAgentCreator } from "@/lib/db/agents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: agentId } = await params;

  // 仅允许登录用户
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    // 检查权限 - 验证用户是否为Agent创建者
    const isCreator = await isAgentCreator(userId, agentId);
    if (!isCreator) {
      return NextResponse.json(
        { success: false, error: "无权修改此Agent" },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { isPublic } = body;

    // 验证isPublic参数
    if (typeof isPublic !== "boolean") {
      return NextResponse.json(
        { success: false, error: "isPublic必须是布尔值" },
        { status: 400 }
      );
    }

    // 更新公开状态
    const updated = await setAgentPublic(userId, agentId, isPublic);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "更新公开状态失败" },
        { status: 500 }
      );
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        isPublic: updated.is_public,
      },
    });
  } catch (error) {
    console.error("更新Agent公开状态失败:", error);
    return NextResponse.json(
      { success: false, error: "更新公开状态失败" },
      { status: 500 }
    );
  }
}