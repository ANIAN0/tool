/**
 * 发送消息并启动 workflow 接口
 * POST /api/workflowchat/conversations/:id/messages
 *
 * 完整流程：写消息 → 创建 run → reconcile → start workflow → CAS claim → 返回 stream
 *
 * 异常场景：
 * - 已有 active run 且仍在运行 → 返回已有 stream 重连
 * - CAS claim 失败 → 409
 * - start(...) 失败 → 500
 * - 环境变量缺失 → 500
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createUIMessageStreamResponse } from 'ai';
import {
  sendMessage,
  reconnectWorkflowRun,
  SendMessageConflictError,
  SendMessageConfigError,
} from '@/lib/workflowchat/service';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 发送消息
 * POST /api/workflowchat/conversations/:id/messages
 * 请求体：{ "content": "消息内容", "modelId": "gpt-4.1-mini" }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: conversationId } = await params;

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { content, modelId } = body;

    // 参数校验：content 必填且为字符串
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content 参数必填且为字符串' },
        { status: 400 },
      );
    }

    // modelId 可选
    const resolvedModelId = typeof modelId === 'string' ? modelId : undefined;

    // 将纯文本内容转换为 UIMessage parts JSON 格式
    const partsJson = JSON.stringify([{ type: 'text', text: content }]);

    console.log("[messages API] 调用 sendMessage, conversationId:", conversationId, "content:", content, "modelId:", resolvedModelId);

    // 调用服务层：写消息 → 创建 run → reconcile → start workflow → CAS claim
    const { workflowRun } = await sendMessage(
      conversationId,
      null,
      partsJson,
      resolvedModelId,
    );

    // 成功：返回流式响应
    return createUIMessageStreamResponse({
      stream: workflowRun.readable,
      headers: {
        'x-workflow-run-id': workflowRun.runId,
      },
    });
  } catch (error) {
    // 已有 active run 重连：返回已有 stream
    if (error instanceof SendMessageConflictError && error.existingRun) {
      console.log("[messages API] 冲突重连, existingRunId:", error.existingRun.id, "workflowRunId:", error.existingRun.workflowRunId);
      try {
        const existingRun = await reconnectWorkflowRun(
          error.existingRun.workflowRunId!,
        );

        return createUIMessageStreamResponse({
          stream: existingRun.readable,
          headers: {
            'x-workflow-run-id': error.existingRun.workflowRunId!,
          },
        });
      } catch (reconnectError) {
        console.error('[workflowchat] 重连已有 stream 失败:', reconnectError);
        return NextResponse.json(
          { error: '重连已有 stream 失败' },
          { status: 500 },
        );
      }
    }

    // CAS claim 失败：409
    if (error instanceof SendMessageConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 },
      );
    }

    // 环境变量缺失：500
    if (error instanceof SendMessageConfigError) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    // 其他错误：500
    console.error('[workflowchat] 发送消息失败:', error);
    return NextResponse.json(
      { error: '发送消息失败' },
      { status: 500 },
    );
  }
}