/**
 * 发送消息并启动 workflow 接口
 * POST /api/workflowchat/conversations/:id/messages
 *
 * 完整流程：校验权限 → 校验 agentId → 写消息 → 创建 run → reconcile → start workflow → CAS claim → 返回 stream
 *
 * 认证模式：强制 JWT 认证（从 Authorization Header 提取 userId）
 * 权限校验：会话只能被创建者访问（userId 匹配）
 * AgentId 校验：传入的 agentId 必须与会话绑定的 agentId 一致
 *
 * 异常场景：
 * - 权限校验失败 → 403
 * - agentId 不匹配 → 400
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
  SendMessageAgentMismatchError,
  getConversationDetail,
} from '@/lib/workflowchat/service';
import { authenticateRequest } from '@/lib/infra/user/middleware';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 发送消息
 * POST /api/workflowchat/conversations/:id/messages
 * 请求体：{ "agentId": "必填", "content": "消息内容", "modelId": "可选模型ID" }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: conversationId } = await params;

  // 验证 JWT Token
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: authResult.error } },
      { status: authResult.status },
    );
  }

  const userId = authResult.userId!;

  // 权限校验：验证会话存在且属于当前用户
  const conversationDetail = await getConversationDetail(conversationId);
  if (!conversationDetail) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '会话不存在' } },
      { status: 404 },
    );
  }

  // 权限校验：会话只能被创建者访问
  if (conversationDetail.conversation.userId !== userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '无权访问该会话' } },
      { status: 403 },
    );
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { agentId, content, modelId } = body;

    // 参数校验：agentId 必填且为字符串
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'agentId 参数必填且为字符串' } },
        { status: 400 },
      );
    }

    // 参数校验：content 必填且为字符串
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'content 参数必填且为字符串' } },
        { status: 400 },
      );
    }

    // modelId 可选
    const resolvedModelId = typeof modelId === 'string' ? modelId : undefined;

    // 将纯文本内容转换为 UIMessage parts JSON 格式
    const partsJson = JSON.stringify([{ type: 'text', text: content }]);

    console.log("[messages API] 调用 sendMessage, conversationId:", conversationId, "agentId:", agentId, "content:", content, "modelId:", resolvedModelId);

    // 调用服务层：校验 agentId → 写消息 → 创建 run → reconcile → start workflow → CAS claim
    const { workflowRun } = await sendMessage(
      conversationId,
      agentId,
      userId,
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
    // Agent ID 不匹配：400
    if (error instanceof SendMessageAgentMismatchError) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_MISMATCH',
            message: error.message,
            expectedAgentId: error.expectedAgentId,
            providedAgentId: error.providedAgentId,
          }
        },
        { status: 400 },
      );
    }

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
          { error: { code: 'INTERNAL_ERROR', message: '重连已有 stream 失败' } },
          { status: 500 },
        );
      }
    }

    // CAS claim 失败：409
    if (error instanceof SendMessageConflictError) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: error.message } },
        { status: 409 },
      );
    }

    // 环境变量缺失：500
    if (error instanceof SendMessageConfigError) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    // 其他错误：500
    console.error('[workflowchat] 发送消息失败:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '发送消息失败' } },
      { status: 500 },
    );
  }
}