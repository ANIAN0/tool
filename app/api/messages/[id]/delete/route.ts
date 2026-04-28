/**
 * 删除消息 API
 * DELETE /api/messages/[id]/delete
 *
 * 级联删除：删除目标消息及之后所有消息
 * 注意：只能删除 checkpoint 之后的消息，不影响 compression_cache
 */

import { NextRequest } from "next/server";
import { retractMessage } from "@/lib/db/message-retract";
import { authenticateRequestOptional } from "@/lib/infra/user/middleware";

/**
 * DELETE /api/messages/[id]/delete
 * 撤回单条消息（级联删除后续消息）
 *
 * 请求参数：
 * - id: 消息ID（URL路径参数）
 *
 * 响应格式：
 * { success: boolean, deletedCount: number }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户身份
  const authResult = await authenticateRequestOptional(req);
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const userId = authResult.userId;
  const { id: messageId } = await params;

  try {
    // 执行级联删除（归档 + 删除）
    // 幂等性处理：如果消息已不存在，返回deletedCount=0
    const result = await retractMessage(
      messageId,
      userId,
      "user-delete"
    );

    // 注意：不需要清除 compression_cache
    // 原因：用户只能删除 checkpoint 之后的消息，而 cache 存储的是 checkpoint 之前的消息
    // 删除操作不影响缓存中的内容

    // 无论消息是否存在，都返回成功（幂等性）
    return new Response(
      JSON.stringify({ success: true, deletedCount: result.deletedCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("删除消息失败:", error);

    const errorMessage = error instanceof Error ? error.message : "删除失败";

    // 区分不同错误类型
    if (errorMessage === "对话不存在") {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage === "无权操作此消息") {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "服务器内部错误" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}