/**
 * 调试 run stream 内容接口
 * GET /api/workflowchat/debug/runs/:runId/streams/:streamName — World SDK 流内容
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getDebugRunStream } from '@/lib/workflow-debug/service';

interface RouteParams {
  params: Promise<{ runId: string; streamName: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { runId, streamName } = await params;
    const { searchParams } = new URL(request.url);

    // 解析分页参数
    const cursor = searchParams.get('cursor') ?? undefined;
    const limitParam = searchParams.get('limit');
    let limit: number | undefined;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 500) {
        return NextResponse.json(
          { error: 'limit 参数须为 1~500 之间的整数' },
          { status: 400 },
        );
      }
    }

    const result = await getDebugRunStream(runId, streamName, { cursor, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[workflowchat/debug] 获取 run stream 失败:', error);
    return NextResponse.json(
      { error: '获取 run stream 失败' },
      { status: 500 },
    );
  }
}