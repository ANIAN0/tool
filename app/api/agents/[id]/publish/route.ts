/**
 * Agent公开状态API路由
 * PATCH: 切换Agent公开/私有状态（仅创建者）
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/infra/user/middleware";
import { setAgentPublic, isAgentCreator, getAgentById } from "@/lib/db/agents";

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

    // 返回成功响应 - 包含完整的Agent信息（含工具）
    // 使用getAgentById获取AgentWithTools，与Hook期望格式一致
    const agentWithTools = await getAgentById(agentId, userId);

    if (!agentWithTools) {
      return NextResponse.json(
        { success: false, error: "获取更新后的Agent失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: agentWithTools,
    });
  } catch (error) {
    console.error("更新Agent公开状态失败:", error);
    return NextResponse.json(
      { success: false, error: "更新公开状态失败" },
      { status: 500 }
    );
  }
}