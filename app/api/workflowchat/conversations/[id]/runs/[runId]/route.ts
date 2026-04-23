/**
 * Run 状态查询接口
 * GET /api/workflowchat/conversations/:id/runs/:runId — 获取 run 状态
 *
 * :runId 为 workflow_run_id
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getRunByWorkflowRunId } from '@/lib/workflowchat/service';

interface RouteParams {
  params: Promise<{ id: string; runId: string }>;
}

/**
 * 获取 run 状态
 * GET /api/workflowchat/conversations/:id/runs/:runId
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: conversationId, runId: workflowRunId } = await params;

    const run = await getRunByWorkflowRunId(workflowRunId);

    if (!run) {
      return NextResponse.json(
        { error: 'Run 不存在' },
        { status: 404 },
      );
    }

    // 验证 run 属于该会话
    if (run.conversationId !== conversationId) {
      return NextResponse.json(
        { error: 'Run 不属于该会话' },
        { status: 403 },
      );
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error('[workflowchat] 获取 run 状态失败:', error);
    return NextResponse.json(
      { error: '获取 run 状态失败' },
      { status: 500 },
    );
  }
}