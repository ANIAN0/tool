/**
 * 调试 run events 接口
 * GET /api/workflowchat/debug/runs/:runId/events — World SDK 事件列表
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getDebugRunEvents } from '@/lib/workflow-debug/service';

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析分页参数
    const cursor = searchParams.get('cursor') ?? undefined;
    const limitParam = searchParams.get('limit');
    let limit: number | undefined;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 200) {
        return NextResponse.json(
          { error: 'limit 参数须为 1~200 之间的整数' },
          { status: 400 },
        );
      }
    }

    const result = await getDebugRunEvents(runId, { cursor, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[workflowchat/debug] 获取 run events 失败:', error);
    return NextResponse.json(
      { error: '获取 run events 失败' },
      { status: 500 },
    );
  }
}