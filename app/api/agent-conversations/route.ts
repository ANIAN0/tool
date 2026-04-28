import { getConversationsWithFilter } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestOptional } from "@/lib/infra/user/middleware";

/**
 * Agent对话列表 API
 * 获取当前用户的Agent对话列表（仅返回source='agent-chat'的对话）
 *
 * 请求格式：
 * GET /api/agent-conversations
 * Headers: Authorization (JWT) 或 X-Anonymous-Id
 *
 * 响应格式：
 * { conversations: Conversation[] }
 */
export async function GET(request: NextRequest) {
  // 调试：打印请求头信息
  console.log("[Agent Conversations] 请求头信息:");
  console.log("  Authorization:", request.headers.get("Authorization") || "未提供");
  console.log("  X-Anonymous-Id:", request.headers.get("X-Anonymous-Id") || "未提供");

  // 使用标准认证中间件验证用户身份
  const authResult = await authenticateRequestOptional(request);
  console.log("[Agent Conversations] 认证结果:", JSON.stringify(authResult));

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    // 获取用户的Agent对话列表（仅agent-chat来源）
    const conversations = await getConversationsWithFilter(userId, {
      source: "agent-chat",
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("获取Agent对话列表失败:", error);

    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}