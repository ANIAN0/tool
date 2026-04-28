/**
 * 会话管理模块
 * 处理对话检查、创建、权限验证和历史消息加载
 */

import type { UIMessage } from "ai";
import { nanoid } from "nanoid";
import {
  getConversation,
  createConversation,
  createMessage,
} from "@/lib/db";
import {
  getPendingCompressionTask,
  completeCompressionTask,
  loadHistoryMessages,
  executeCompressionTask,
} from "@/lib/db/compression";
import type {
  ConversationResult,
  HistoryResult,
  EnsureConversationParams,
} from "./types";

/**
 * 从消息内容提取对话标题
 * 截取前50个字符作为标题预览
 *
 * @param content - 消息文本内容
 * @returns 提取的标题字符串
 */
function extractTitle(content: string): string {
  // 空内容返回默认标题
  if (!content) return "新对话";
  // 换行符替换为空格，截取前50字符
  const title = content.replace(/\n/g, " ").slice(0, 50);
  // 内容过长时添加省略号
  return title.length < content.length ? `${title}...` : title;
}

/**
 * 确保对话存在且用户有权访问
 * 检查对话是否存在：
 * - 存在：验证用户权限
 * - 不存在：创建新对话
 *
 * @param params - 创建对话的参数
 * @returns 会话验证结果，成功返回 conversationId，失败返回错误响应
 *
 * @example
 * ```typescript
 * // route.ts（组装者）
 * const convResult = await ensureConversation({
 *   conversationId,
 *   userId,
 *   agentId,
 *   modelName,
 *   message,
 * });
 * if (!convResult.ok) return convResult.response;
 * // 使用 convResult.conversationId
 * ```
 */
export async function ensureConversation(
  params: EnsureConversationParams
): Promise<ConversationResult> {
  const { conversationId, userId, agentId, modelName, message } = params;

  // 检查对话是否存在
  const conversation = await getConversation(conversationId);

  if (conversation) {
    // 对话已存在，验证权限
    if (conversation.user_id !== userId) {
      // 权限不匹配：返回403错误
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "无权访问此对话" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    // 权限验证通过：返回对话ID
    return { ok: true, conversationId };
  }

  // 对话不存在，创建新对话
  // 从用户消息提取标题
  const title = message.role === "user"
    ? extractTitle(
        message.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("")
      )
    : "新对话";

  // 创建新对话记录（处理并发竞态：同一 conversationId 可能已被其他请求创建）
  try {
    await createConversation({
      id: conversationId,
      userId,
      title,
      model: modelName,
      agentId,
      source: "agent-chat",
    });
  } catch (createError: any) {
    // 主键冲突说明其他请求已创建该对话，验证权限后返回即可
    if (createError?.code === "SQLITE_CONSTRAINT_PRIMARYKEY" || createError?.message?.includes("UNIQUE constraint failed")) {
      const existing = await getConversation(conversationId);
      if (existing && existing.user_id === userId) {
        return { ok: true, conversationId };
      }
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "无权访问此对话" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    throw createError;
  }

  // 返回创建后的对话ID
  return { ok: true, conversationId };
}

/**
 * 保存用户消息到数据库
 *
 * @param conversationId - 会话 ID
 * @param message - 用户消息（UIMessage 格式）
 */
export async function saveUserMessage(
  conversationId: string,
  message: UIMessage
): Promise<void> {
  // 生成消息 ID（使用传入 ID 或新生成）
  const userMessageId = message.id || nanoid();
  // 构建完整用户消息对象
  const fullUserMessage: UIMessage = {
    id: userMessageId,
    role: "user",
    parts: message.parts,
  };

  // 持久化用户消息
  await createMessage({
    id: userMessageId,
    conversationId,
    role: "user",
    content: JSON.stringify(fullUserMessage),
  });
}

/**
 * 加载历史消息
 * 包括执行待处理的压缩任务，然后加载历史消息
 *
 * @param conversationId - 会话 ID
 * @returns 历史消息加载结果，成功返回消息列表，失败返回错误响应
 *
 * @example
 * ```typescript
 * // route.ts（组装者）
 * const historyResult = await loadHistory(conversationId);
 * if (!historyResult.ok) return historyResult.response;
 * // 使用 historyResult.messages
 * ```
 */
export async function loadHistory(
  conversationId: string
): Promise<HistoryResult> {
  // 检查并执行未处理的压缩任务（在用户消息保存之前）
  const pendingTask = await getPendingCompressionTask(conversationId);

  if (pendingTask) {
    try {
      // 执行压缩（使用统一的加载历史消息逻辑）
      const { removedCount } = await executeCompressionTask(conversationId);

      // 标记任务完成（无论是否实际压缩，都标记完成，避免死循环）
      await completeCompressionTask(pendingTask.id);

      // 记录压缩完成日志
      console.log("[agent-chat 压缩执行] 完成:", {
        taskId: pendingTask.id,
        removedCount,
      });
    } catch (error) {
      // 压缩失败：任务状态不变（pending），下次重试
      // 不影响本次请求，继续执行
      console.error("[agent-chat 压缩执行] 失败:", error);
    }
  }

  // 加载历史消息（在保存用户消息之前加载，避免重复包含当前消息）
  try {
    const messages = await loadHistoryMessages(conversationId);
    return { ok: true, messages };
  } catch (error) {
    // 加载失败：返回500错误
    console.error("[agent-chat 历史消息加载] 失败:", error);
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "加载历史消息失败" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
}