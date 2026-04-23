/**
 * Run stream 重连接口
 * GET /api/workflowchat/conversations/:id/runs/:runId/stream
 *
 * 返回 run.getReadable()，AI SDK 原生 UIMessageStream 格式
 * 发现终态 run 时清除 stale activeStreamId
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createUIMessageStreamResponse } from 'ai';
import {
  getRunByWorkflowRunId,
  reconnectWorkflowRun,
  reconcileExistingActiveStream,
} from '@/lib/workflowchat/service';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string; runId: string }>;
}

/**
 * 重连现有 stream
 * GET /api/workflowchat/conversations/:id/runs/:runId/stream
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: conversationId, runId: workflowRunId } = await params;

  try {
    // 获取 run 状态信息
    const run = await getRunByWorkflowRunId(workflowRunId);

    // run 不存在：清除 stale activeStreamId，返回 204 表示无活跃 stream
    if (!run) {
      reconcileExistingActiveStream(conversationId).catch(() => {});
      return new NextResponse(null, { status: 204 });
    }

    // 验证 run 属于该会话
    if (run.conversationId !== conversationId) {
      return NextResponse.json(
        { error: 'Run 不属于该会话' },
        { status: 403 },
      );
    }

    // 终态 run：清除 stale activeStreamId，返回 204 表示无活跃 stream
    if (run.status === 'completed' || run.status === 'failed') {
      reconcileExistingActiveStream(conversationId).catch(() => {});
      return new NextResponse(null, { status: 204 });
    }

    // run 仍在运行：获取 Run 句柄并返回 stream
    const workflowRun = await reconnectWorkflowRun(workflowRunId);

    return createUIMessageStreamResponse({
      stream: workflowRun.readable,
      headers: {
        'x-workflow-run-id': workflowRunId,
      },
    });
  } catch (error) {
    console.error('[workflowchat] 获取 stream 失败:', error);

    // run 句柄获取失败（可能 World 侧已不存在），清除 stale 并返回 204
    reconcileExistingActiveStream(conversationId).catch(() => {});
    return new NextResponse(null, { status: 204 });
  }
}