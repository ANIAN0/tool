import { getConversations } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestOptional } from "@/lib/infra/user/middleware";

/**
 * 对话列表 API
 * 获取当前用户的所有对话列表
 *
 * 请求格式：
 * GET /api/conversations
 * Headers: Authorization (JWT) 或 X-Anonymous-Id
 *
 * 响应格式：
 * { conversations: Conversation[] }
 */
export async function GET(request: NextRequest) {
  // 使用标准认证中间件验证用户身份
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    // 获取用户的对话列表（按更新时间倒序）
    const conversations = await getConversations(userId);

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("获取对话列表失败:", error);

    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
