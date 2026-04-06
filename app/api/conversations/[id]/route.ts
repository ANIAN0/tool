import {
  getConversation,
  getMessages,
  deleteConversation,
  deleteMessagesByConversation,
  updateConversation,
  getAgentById,
  getUserModelById,
  getDefaultUserModel,
} from "@/lib/db";
// 新增：压缩数据清理函数和 checkpoint 获取函数
import { cleanupCompressionData, getLatestCheckpoint } from "@/lib/db/compression";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestOptional } from "@/lib/auth/middleware";

/**
 * 单个对话详情 API
 * 获取指定对话的完整信息及消息列表
 *
 * 请求格式：
 * GET /api/conversations/:id
 * Headers: Authorization (JWT) 或 X-Anonymous-Id
 *
 * 响应格式：
 * {
 *   conversation: Conversation,
 *   messages: Message[],
 *   metadataContext?: { contextLimit: number, modelName: string }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 使用标准认证中间件验证用户身份
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    // 获取对话ID
    const { id: conversationId } = await params;

    // 获取对话信息
    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: "对话不存在" },
        { status: 404 }
      );
    }

    // 验证用户权限（只能访问自己的对话）
    if (conversation.user_id !== userId) {
      return NextResponse.json(
        { error: "无权访问此对话" },
        { status: 403 }
      );
    }

    // 🚀 性能优化：并行获取消息列表和 checkpoint 信息
    const [messages, latestCheckpoint] = await Promise.all([
      getMessages(conversationId),
      getLatestCheckpoint(conversationId),
    ]);

    // 计算 checkpoint 之后的消息数量（用于前端计算删除边界）
    // 前端需要知道：checkpoint 之前的消息不能删除
    let checkpointMessageCount = 0;
    if (latestCheckpoint) {
      // 找到 checkpoint 时间戳之后的第一条消息的索引
      const checkpointCreatedAt = latestCheckpoint.created_at;
      // 计算创建时间大于 checkpoint 的消息数量
      checkpointMessageCount = messages.filter(
        (msg) => msg.created_at > checkpointCreatedAt
      ).length;
    }

    // 获取 metadata 信息（用于历史消息显示 Context 组件）
    // 从 conversation.agent_id -> agent -> userModel 获取 contextLimit 和 modelName
    let metadataContext: { contextLimit: number; modelName: string } | undefined;

    // 只有 agent-chat 来源的对话才需要 metadata
    if (conversation.source === 'agent-chat' && conversation.agent_id) {
      try {
        // 🚀 性能优化：Early-start pattern - 提前启动 defaultModel Promise
        // 如果 agent 未绑定模型，将使用此 Promise 的结果
        const defaultModelPromise = getDefaultUserModel(userId);

        // 获取 agent 配置（使用 conversation 创建者的 userId）
        const agent = await getAgentById(conversation.agent_id, conversation.user_id);
        if (agent) {
          // 根据 agent.model_id 决定使用哪个模型配置
          const userModel = agent.model_id
            ? await getUserModelById(agent.user_id, agent.model_id)
            : await defaultModelPromise; // 使用提前启动的 Promise

          if (userModel) {
            metadataContext = {
              contextLimit: userModel.context_limit ?? 32000,
              modelName: userModel.model,
            };
          }
        }
      } catch (error) {
        // 获取失败不影响主流程，仅记录日志
        console.error("获取 metadataContext 失败:", error);
      }
    }

    return NextResponse.json({
      conversation,
      messages,
      metadataContext,
      // 新增：checkpoint 信息（用于前端判断消息删除权限）
      checkpoint: latestCheckpoint ? {
        removedCount: latestCheckpoint.removed_count,
        originalMessageCount: latestCheckpoint.original_message_count,
        createdAt: latestCheckpoint.created_at,
        // checkpoint 之后的消息数量（前端用于计算删除边界）
        messagesAfterCheckpoint: checkpointMessageCount,
      } : null,
    });
  } catch (error) {
    console.error("获取对话详情失败:", error);

    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

/**
 * 删除对话 API
 * 删除指定对话及其所有消息
 *
 * 请求格式：
 * DELETE /api/conversations/:id
 * Headers: Authorization (JWT) 或 X-Anonymous-Id
 *
 * 响应格式：
 * { success: boolean }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 使用标准认证中间件验证用户身份
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    // 获取对话ID
    const { id: conversationId } = await params;

    // 获取对话信息
    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: "对话不存在" },
        { status: 404 }
      );
    }

    // 验证用户权限（只能删除自己的对话）
    if (conversation.user_id !== userId) {
      return NextResponse.json(
        { error: "无权删除此对话" },
        { status: 403 }
      );
    }

    // 删除顺序：先删除消息，再清理压缩数据，最后删除对话
    // 清理压缩数据：compression_tasks 和 checkpoints 表中的关联记录
    await deleteMessagesByConversation(conversationId);
    await cleanupCompressionData(conversationId);
    const deleted = await deleteConversation(conversationId);

    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("删除对话失败:", error);

    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

/**
 * 重命名对话 API
 * 更新指定对话的标题
 *
 * 请求格式：
 * PATCH /api/conversations/:id
 * Headers: Authorization (JWT) 或 X-Anonymous-Id
 * Body: { title: string }
 *
 * 响应格式：
 * { conversation: Conversation }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 使用标准认证中间件验证用户身份
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    // 获取对话ID
    const { id: conversationId } = await params;

    // 获取对话信息
    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: "对话不存在" },
        { status: 404 }
      );
    }

    // 验证用户权限（只能重命名自己的对话）
    if (conversation.user_id !== userId) {
      return NextResponse.json(
        { error: "无权修改此对话" },
        { status: 403 }
      );
    }

    // 解析请求体获取新标题
    const body = await request.json();
    const { title } = body;

    // 验证标题不为空
    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "标题不能为空" },
        { status: 400 }
      );
    }

    // 更新对话标题
    const updated = await updateConversation(conversationId, { title: title.trim() });

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error("重命名对话失败:", error);

    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
