/**
 * 对外消息列表接口
 * GET /api/v1/conversations/[id]/messages
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/auth/api-key-middleware";
import { getConversation, getMessages } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取会话消息列表
 * GET /api/v1/conversations/[id]/messages
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 验证 API Key
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) {
    return apiKeyErrorResponse(authResult);
  }

  const userId = authResult.userId;

  try {
    // 验证会话存在且属于用户
    const conversation = await getConversation(id);
    if (!conversation || conversation.user_id !== userId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "会话不存在" } },
        { status: 404 }
      );
    }

    // 获取消息列表
    const messages = await getMessages(id);

    return NextResponse.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.created_at,
      })),
    });
  } catch (error) {
    console.error("获取消息列表失败:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取消息列表失败" } },
      { status: 500 }
    );
  }
}