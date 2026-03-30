/**
 * 对外会话列表接口
 * GET /api/v1/conversations
 * POST /api/v1/conversations
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/auth/api-key-middleware";
import { getConversationsWithFilter, createConversation } from "@/lib/db";
import { nanoid } from "nanoid";

/**
 * 获取会话列表
 * GET /api/v1/conversations
 */
export async function GET(request: NextRequest) {
  // 验证 API Key
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) {
    return apiKeyErrorResponse(authResult);
  }

  const userId = authResult.userId;

  try {
    // 获取用户的会话列表，仅返回通过 API 创建的会话（source: "api-v1"）
    const conversations = await getConversationsWithFilter(userId, { source: "api-v1" });

    return NextResponse.json({
      conversations: conversations.map((conv) => ({
        id: conv.id,
        title: conv.title,
        agentId: conv.agent_id,
        source: conv.source,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      })),
    });
  } catch (error) {
    console.error("获取会话列表失败:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取会话列表失败" } },
      { status: 500 }
    );
  }
}

/**
 * 创建新会话
 * POST /api/v1/conversations
 */
export async function POST(request: NextRequest) {
  // 验证 API Key
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) {
    return apiKeyErrorResponse(authResult);
  }

  const userId = authResult.userId;

  try {
    const body = await request.json();
    const { title, agentId } = body;

    // 创建会话
    const conversation = await createConversation({
      id: nanoid(),
      userId,
      title: title || "新对话",
      agentId: agentId || "production",
      source: "api-v1",
    });

    return NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        title: conversation.title,
        agentId: conversation.agent_id,
        createdAt: conversation.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("创建会话失败:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "创建会话失败" } },
      { status: 500 }
    );
  }
}