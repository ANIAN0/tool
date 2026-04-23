/**
 * 会话详情接口
 * GET /api/workflowchat/conversations/:id — 获取会话详情与消息历史
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getConversationDetail } from '@/lib/workflowchat/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取会话详情（含消息历史和 activeStreamId）
 * GET /api/workflowchat/conversations/:id
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const detail = await getConversationDetail(id);

    if (!detail) {
      return NextResponse.json(
        { error: '会话不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[workflowchat] 获取会话详情失败:', error);
    return NextResponse.json(
      { error: '获取会话详情失败' },
      { status: 500 },
    );
  }
}