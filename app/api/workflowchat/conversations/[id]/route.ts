/**
 * 会话详情接口
 * GET /api/workflowchat/conversations/:id — 获取会话详情与消息历史
 *
 * 认证模式：强制 JWT 认证（从 Authorization Header 提取 userId）
 * 权限校验：会话只能被创建者访问（userId 匹配）
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getWfChatConversation,
  updateWfChatConversation,
  deleteWfChatConversation,
  deleteWfChatMessagesByConversationId,
} from '@/lib/workflowchat/repository';
import { getConversationDetail } from '@/lib/workflowchat/service';
import { authenticateRequest } from '@/lib/infra/user/middleware';
import type { ConversationDTO } from '@/lib/workflowchat/dto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取会话详情（含消息历史和 activeStreamId）
 * GET /api/workflowchat/conversations/:id
 *
 * 认证：JWT 鉴权
 * 权限：仅会话创建者可访问
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;

    const detail = await getConversationDetail(id);

    if (!detail) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '会话不存在' } },
        { status: 404 },
      );
    }

    // 权限校验：会话只能被创建者访问
    if (detail.conversation.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '无权访问该会话' } },
        { status: 403 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[workflowchat] 获取会话详情失败:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '获取会话详情失败' } },
      { status: 500 },
    );
  }
}

/**
 * 删除会话
 * DELETE /api/workflowchat/conversations/:id
 *
 * 认证：JWT 鉴权
 * 权限：仅会话创建者可删除
 * CASCADE：同时删除关联消息
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: authResult.error } },
      { status: authResult.status },
    );
  }

  const userId = authResult.userId!;

  try {
    const { id } = await params;

    const conversation = await getWfChatConversation(id);
    if (!conversation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '会话不存在' } },
        { status: 404 },
      );
    }

    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '无权删除该会话' } },
        { status: 403 },
      );
    }

    await deleteWfChatMessagesByConversationId(id);
    await deleteWfChatConversation(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[workflowchat] 删除会话失败:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '删除会话失败' } },
      { status: 500 },
    );
  }
}

/**
 * 更新会话标题
 * PATCH /api/workflowchat/conversations/:id
 *
 * 认证：JWT 鉴权
 * 权限：仅会话创建者可更新
 * 参数：title (非空字符串)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: authResult.error } },
      { status: authResult.status },
    );
  }

  const userId = authResult.userId!;

  try {
    const { id } = await params;

    const conversation = await getWfChatConversation(id);
    if (!conversation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '会话不存在' } },
        { status: 404 },
      );
    }

    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '无权修改该会话' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: '标题不能为空' } },
        { status: 400 },
      );
    }

    const updated = await updateWfChatConversation(id, { title: title.trim() });

    const dto: ConversationDTO = {
      id: updated!.id,
      userId: updated!.userId,
      agentId: updated!.agentId,
      title: updated!.title,
      status: updated!.status,
      activeStreamId: updated!.activeStreamId,
      lastMessageAt: updated!.lastMessageAt,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
      totalInputTokens: updated!.totalInputTokens,
      totalOutputTokens: updated!.totalOutputTokens,
      totalTokens: updated!.totalTokens,
    };

    return NextResponse.json(dto);
  } catch (error) {
    console.error('[workflowchat] 更新会话失败:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '更新会话失败' } },
      { status: 500 },
    );
  }
}