/**
 * 会话列表与创建接口
 * GET  /api/workflowchat/conversations  — 获取会话列表（userId 可选）
 * POST /api/workflowchat/conversations  — 创建新会话
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  createConversation,
  listConversationsByUserId,
  listAllConversations,
} from '@/lib/workflowchat/service';

/**
 * 创建新会话
 * POST /api/workflowchat/conversations
 * 请求体：{ "title": "可选标题", "userId": "可选用户ID" }
 */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const title = typeof body.title === 'string' ? body.title : null;
    // 首版不强制登录，userId 可从前端传入或为 null
    const userId = typeof body.userId === 'string' ? body.userId : null;

    const conversation = await createConversation(userId, title);

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('[workflowchat] 创建会话失败:', error);
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 },
    );
  }
}

/**
 * 获取会话列表
 * GET /api/workflowchat/conversations?userId=xxx
 * 首版不强制登录：无 userId 时返回所有会话
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // 首版不强制登录：有 userId 时按用户过滤，否则返回所有会话
    const conversations = userId
      ? await listConversationsByUserId(userId)
      : await listAllConversations();

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[workflowchat] 获取会话列表失败:', error);
    return NextResponse.json(
      { error: '获取会话列表失败' },
      { status: 500 },
    );
  }
}