/**
 * 对外会话详情接口
 * GET /api/v1/conversations/[id]
 * DELETE /api/v1/conversations/[id]
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/infra/user/api-key";
import { getConversation, getMessages, deleteConversation } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取会话详情（包含消息）
 * GET /api/v1/conversations/[id]
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
    // 获取会话详情
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
      success: true,
      data: {
        id: conversation.id,
        title: conversation.title,
        agentId: conversation.agent_id,
        source: conversation.source,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("获取会话详情失败:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取会话详情失败" } },
      { status: 500 }
    );
  }
}

/**
 * 删除会话
 * DELETE /api/v1/conversations/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // 删除会话
    const deleted = await deleteConversation(id);

    return NextResponse.json({
      success: deleted,
    });
  } catch (error) {
    console.error("删除会话失败:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "删除会话失败" } },
      { status: 500 }
    );
  }
}