import {
  getConversation,
  getMessages,
  deleteConversation,
  deleteMessagesByConversation,
  updateConversation,
} from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * 单个对话详情 API
 * 获取指定对话的完整信息及消息列表
 * 
 * 请求格式：
 * GET /api/conversations/:id
 * Headers: X-User-Id
 * 
 * 响应格式：
 * { conversation: Conversation, messages: Message[] }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "用户ID不能为空" },
        { status: 401 }
      );
    }

    // 获取对话ID
    const { id: conversationId } = await params;

    // 获取对话信息
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json(
        { error: "对话不存在" },
        { status: 404 }
      );
    }

    // 验证用户权限（只能访问自己的对话）
    if (conversation.user_id !== userId) {
      return NextResponse.json(
        { error: "无权访问此对话" },
        { status: 403 }
      );
    }

    // 获取消息列表（按创建时间升序）
    const messages = await getMessages(conversationId);

    return NextResponse.json({ conversation, messages });
  } catch (error) {
    console.error("获取对话详情失败:", error);
    
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

/**
 * 删除对话 API
 * 删除指定对话及其所有消息
 * 
 * 请求格式：
 * DELETE /api/conversations/:id
 * Headers: X-User-Id
 * 
 * 响应格式：
 * { success: boolean }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "用户ID不能为空" },
        { status: 401 }
      );
    }

    // 获取对话ID
    const { id: conversationId } = await params;

    // 获取对话信息
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json(
        { error: "对话不存在" },
        { status: 404 }
      );
    }

    // 验证用户权限（只能删除自己的对话）
    if (conversation.user_id !== userId) {
      return NextResponse.json(
        { error: "无权删除此对话" },
        { status: 403 }
      );
    }

    // 先删除消息，再删除对话
    await deleteMessagesByConversation(conversationId);
    const deleted = await deleteConversation(conversationId);

    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("删除对话失败:", error);
    
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

/**
 * 重命名对话 API
 * 更新指定对话的标题
 * 
 * 请求格式：
 * PATCH /api/conversations/:id
 * Headers: X-User-Id
 * Body: { title: string }
 * 
 * 响应格式：
 * { conversation: Conversation }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "用户ID不能为空" },
        { status: 401 }
      );
    }

    // 获取对话ID
    const { id: conversationId } = await params;

    // 获取对话信息
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json(
        { error: "对话不存在" },
        { status: 404 }
      );
    }

    // 验证用户权限（只能重命名自己的对话）
    if (conversation.user_id !== userId) {
      return NextResponse.json(
        { error: "无权修改此对话" },
        { status: 403 }
      );
    }

    // 解析请求体获取新标题
    const body = await request.json();
    const { title } = body;

    // 验证标题不为空
    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "标题不能为空" },
        { status: 400 }
      );
    }

    // 更新对话标题
    const updated = await updateConversation(conversationId, { title: title.trim() });

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error("重命名对话失败:", error);
    
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
