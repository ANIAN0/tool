/**
 * 会话详情接口
 * GET /api/workflowchat/conversations/:id — 获取会话详情与消息历史
 *
 * 认证模式：强制 JWT 认证（从 Authorization Header 提取 userId）
 * 权限校验：会话只能被创建者访问（userId 匹配）
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getConversationDetail } from '@/lib/workflowchat/service';
import { authenticateRequest } from '@/lib/infra/user/middleware';

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