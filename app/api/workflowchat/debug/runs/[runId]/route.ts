/**
 * 调试 run 详情接口
 * GET /api/workflowchat/debug/runs/:runId — 运行详情 + 步骤 + 水合输入输出
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getDebugRunDetail } from '@/lib/workflow-debug/service';

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;

    const detail = await getDebugRunDetail(runId);

    if (!detail) {
      return NextResponse.json(
        { error: 'run 不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[workflowchat/debug] 获取 run 详情失败:', error);
    return NextResponse.json(
      { error: '获取 run 详情失败' },
      { status: 500 },
    );
  }
}