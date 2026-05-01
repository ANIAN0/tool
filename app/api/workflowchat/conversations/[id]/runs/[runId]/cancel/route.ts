/**
 * Run 取消接口
 * POST /api/workflowchat/conversations/:id/runs/:runId/cancel
 *
 * 调用 workflowRun.cancel() 终止正在执行的 workflow
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getRunByWorkflowRunId, reconcileExistingActiveStream } from '@/lib/workflowchat/service';
import { authenticateRequest } from '@/lib/infra/user/middleware';
import { getRun } from 'workflow/api';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string; runId: string }>;
}

/**
 * 取消正在运行的 workflow run
 * POST /api/workflowchat/conversations/:id/runs/:runId/cancel
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: conversationId, runId: workflowRunId } = await params;

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
    // 获取 run 状态信息
    const run = await getRunByWorkflowRunId(workflowRunId);

    // run 不存在
    if (!run) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Run 不存在' } },
        { status: 404 },
      );
    }

    // 验证 run 属于该会话
    if (run.conversationId !== conversationId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Run 不属于该会话' } },
        { status: 403 },
      );
    }

    // 权限校验：会话只能被创建者访问
    if (run.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '无权访问该会话' } },
        { status: 403 },
      );
    }

    // 终态 run：无需取消
    if (run.status === 'completed' || run.status === 'failed') {
      return NextResponse.json(
        { message: 'Run 已终态，无需取消' },
        { status: 200 },
      );
    }

    // 获取 Workflow Run 句柄并调用 cancel
    const workflowRun = await getRun(workflowRunId);
    await workflowRun.cancel();

    // 清除 active_stream_id
    await reconcileExistingActiveStream(conversationId);

    return NextResponse.json(
      { message: 'Run 已取消', workflowRunId },
      { status: 200 },
    );
  } catch (error) {
    console.error('[workflowchat] 取消 run 失败:', error);

    // Workflow 侧可能已不存在，清除 stale 并返回成功
    await reconcileExistingActiveStream(conversationId).catch(() => {});

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '取消 run 失败' } },
      { status: 500 },
    );
  }
}