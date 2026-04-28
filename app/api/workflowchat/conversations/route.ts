/**
 * 会话列表与创建接口
 * GET  /api/workflowchat/conversations  — 获取当前用户的会话列表
 * POST /api/workflowchat/conversations  — 创建新会话（需认证）
 *
 * 认证模式：强制 JWT 认证（从 Authorization Header 提取 userId）
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  createConversation,
  listConversationsByUserId,
} from '@/lib/workflowchat/service';
import { authenticateRequest } from '@/lib/infra/user/middleware';

/**
 * 创建新会话
 * POST /api/workflowchat/conversations
 * 请求体：{ "agentId": "必填AgentID", "title": "可选标题" }
 *
 * 认证：JWT 鉴权，userId 从 Authorization Header 提取
 */
export async function POST(request: NextRequest) {
  // 验证 JWT Token
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const userId = authResult.userId!;

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // agentId 必填
    const agentId = body.agentId;
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'agentId 参数必填且为字符串' } },
        { status: 400 },
      );
    }

    // title 可选
    const title = typeof body.title === 'string' ? body.title : null;

    // 创建会话：userId 从认证获取，agentId 必填
    const conversation = await createConversation(agentId, userId, title);

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('[workflowchat] 创建会话失败:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '创建会话失败' } },
      { status: 500 },
    );
  }
}

/**
 * 获取当前用户的会话列表
 * GET /api/workflowchat/conversations
 *
 * 认证：JWT 鉴权，仅返回当前用户的会话
 */
export async function GET(request: NextRequest) {
  // 验证 JWT Token
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const userId = authResult.userId!;

  try {
    // 仅返回当前用户的会话
    const conversations = await listConversationsByUserId(userId);

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[workflowchat] 获取会话列表失败:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '获取会话列表失败' } },
      { status: 500 },
    );
  }
}