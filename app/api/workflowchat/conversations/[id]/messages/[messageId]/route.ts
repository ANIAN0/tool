/**
 * 删除消息 API
 * DELETE /api/workflowchat/conversations/:id/messages/:messageId
 *
 * 级联删除：删除目标消息及之后所有消息
 * 权限校验：会话属于当前用户，消息属于该会话
 *
 * 认证模式：强制 JWT 认证（从 Authorization Header 提取 userId）
 * 权限校验：会话创建者（userId 匹配）+ 消息属于会话
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getWfChatConversation,
  getWfChatMessage,
  deleteWfChatMessagesFromId,
  getWfChatMessagesByConversationId,
  touchWfChatConversation,
} from '@/lib/workflowchat/repository';
import { authenticateRequest } from '@/lib/infra/user/middleware';

interface RouteParams {
  params: Promise<{ id: string; messageId: string }>;
}

/**
 * 删除消息（级联删除）
 * DELETE /api/workflowchat/conversations/:id/messages/:messageId
 *
 * 认证：JWT 鉴权
 * 权限：仅会话创建者可删除自己的消息
 * 级联：删除该消息及之后所有消息
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // 验证 JWT Token
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: authResult.error } },
      { status: authResult.status },
    );
  }

  const userId = authResult.userId!;

  try {
    const { id: conversationId, messageId } = await params;

    // 获取会话信息，验证存在性
    const conversation = await getWfChatConversation(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '会话不存在' } },
        { status: 404 },
      );
    }

    // 权限校验：会话只能被创建者访问
    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '无权删除该会话的消息' } },
        { status: 403 },
      );
    }

    // 获取目标消息，验证存在性
    const targetMessage = await getWfChatMessage(messageId);
    if (!targetMessage) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '消息不存在' } },
        { status: 404 },
      );
    }

    // 权限校验：消息必须属于该会话
    if (targetMessage.conversation_id !== conversationId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '消息不存在' } },
        { status: 404 },
      );
    }

    // 级联删除：从目标消息开始删除该会话的所有后续消息
    const deletedCount = await deleteWfChatMessagesFromId(conversationId, messageId);

    // 更新会话的 updated_at 和 last_message_at
    await touchWfChatConversation(conversationId);

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error('[workflowchat] 删除消息失败:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '删除消息失败' } },
      { status: 500 },
    );
  }
}