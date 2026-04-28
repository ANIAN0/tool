/**
 * 请求解析模块
 * 解析 Agent Chat API 的请求体并验证必需字段
 */

import { NextRequest, NextResponse } from "next/server";
import type { ParseResult, ChatRequestBody } from "./types";
import type { UIMessage } from "ai";

/**
 * 解析聊天请求体
 * 从 POST 请求中提取 message、conversationId、agentId 字段
 * 并验证必需字段不为空
 *
 * @param req - Next.js 请求对象
 * @returns 解析结果，成功返回数据，失败返回错误响应
 *
 * @example
 * ```typescript
 * const body = await parseChatRequestBody(req);
 * if (!body.ok) return body.response;
 * // 使用 body.data.message, body.data.conversationId, body.data.agentId
 * ```
 */
export async function parseChatRequestBody(
  req: NextRequest
): Promise<ParseResult> {
  try {
    // 解析 JSON 请求体
    const rawBody = await req.json();

    // 提取并类型化字段
    const { message, conversationId, agentId } = rawBody as {
      message?: UIMessage;
      conversationId?: string;
      agentId?: string;
    };

    // 验证消息不为空（必需字段）
    if (!message) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "消息不能为空" },
          { status: 400 }
        ),
      };
    }

    // 验证消息角色必须是 user
    if (message.role !== "user") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "消息角色必须是 user" },
          { status: 400 }
        ),
      };
    }

    // 验证消息 parts 必须是有效数组
    if (!Array.isArray(message.parts) || message.parts.length === 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "消息内容不能为空" },
          { status: 400 }
        ),
      };
    }

    // 验证对话ID不为空（必需字段）
    if (!conversationId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "对话ID不能为空" },
          { status: 400 }
        ),
      };
    }

    // 验证 Agent ID 不为空（必需字段）
    if (!agentId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Agent ID不能为空" },
          { status: 400 }
        ),
      };
    }

    // 返回成功结果，包含解析后的完整数据
    const data: ChatRequestBody = {
      message,
      conversationId,
      agentId,
    };

    return {
      ok: true,
      data,
    };
  } catch (parseError) {
    // JSON 解析失败，返回错误响应
    return {
      ok: false,
      response: NextResponse.json(
        { error: "请求体格式无效，无法解析JSON" },
        { status: 400 }
      ),
    };
  }
}