/**
 * 异步压缩任务模块
 * 管理压缩任务和 Checkpoint 的 CRUD 操作
 */

import { nanoid } from "nanoid";
import { getDb } from "./client";
import { getMessages } from "./messages";
import {
  getConversation,
  updateCompressionCache,
  clearCompressionCache,
} from "./conversations";
import type {
  CompressionCache,
  CompressionTask,
  Checkpoint,
  MessagePart,
  CompressionTaskStatus,
  CreateCheckpointRecordParams,
} from "./schema";
import { CompressionTaskStatus as TaskStatus } from "./schema";
import type { UIMessage } from "ai";

// 重新导出枚举，方便外部使用
export { CompressionTaskStatus } from "./schema";

// ==================== 压缩任务 CRUD ====================

/**
 * 创建压缩任务
 * 如果会话已有未处理任务，数据库唯一约束会抛出错误
 */
export async function createCompressionTask(params: {
  id: string;
  conversationId: string;
}): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO compression_tasks (id, conversation_id, status, created_at) VALUES (?, ?, ?, ?)`,
    args: [params.id, params.conversationId, TaskStatus.Pending, Date.now()],
  });
}

/**
 * 获取会话的未处理压缩任务
 */
export async function getPendingCompressionTask(
  conversationId: string
): Promise<CompressionTask | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM compression_tasks WHERE conversation_id = ? AND status = ? LIMIT 1`,
    args: [conversationId, TaskStatus.Pending],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    status: row.status as CompressionTaskStatus,
    created_at: row.created_at as number,
    completed_at: row.completed_at as number | null,
  };
}

/**
 * 标记压缩任务完成
 */
export async function completeCompressionTask(taskId: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE compression_tasks SET status = ?, completed_at = ? WHERE id = ?`,
    args: [TaskStatus.Completed, Date.now(), taskId],
  });
}

/**
 * 删除会话关联的所有压缩任务
 * 在删除会话时调用
 */
export async function deleteCompressionTasksByConversation(
  conversationId: string
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM compression_tasks WHERE conversation_id = ?`,
    args: [conversationId],
  });
}

// ==================== Checkpoint CRUD ====================

/**
 * 创建 Checkpoint 记录
 * @param params.cacheContent - 压缩缓存内容（JSON字符串），用于排查问题
 */
export async function createCheckpointRecord(
  params: CreateCheckpointRecordParams
): Promise<Checkpoint> {
  const db = getDb();
  const now = Date.now();
  // 使用 nanoid 生成唯一 ID，避免同一毫秒内的冲突
  const id = `checkpoint-${nanoid(8)}`;

  // 新增 cache_content 字段，存储压缩缓存内容便于排查
  await db.execute({
    sql: `INSERT INTO checkpoints (id, conversation_id, removed_count, original_message_count, created_at, cache_content)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, params.conversationId, params.removedCount, params.originalMessageCount, now, params.cacheContent || null],
  });

  return {
    id,
    conversation_id: params.conversationId,
    removed_count: params.removedCount,
    original_message_count: params.originalMessageCount,
    created_at: now,
    cache_content: params.cacheContent || null,
  };
}

/**
 * 获取会话最新的 Checkpoint
 */
export async function getLatestCheckpoint(
  conversationId: string
): Promise<Checkpoint | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM checkpoints WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
    args: [conversationId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    removed_count: row.removed_count as number,
    original_message_count: row.original_message_count as number,
    created_at: row.created_at as number,
    // 新增：读取 cache_content 字段
    cache_content: row.cache_content as string | null,
  };
}

/**
 * 获取 Checkpoint 之后的消息（UIMessage 格式）
 */
export async function getMessagesAfterLatestCheckpoint(
  conversationId: string
): Promise<UIMessage[]> {
  // 获取最新 checkpoint
  const checkpoint = await getLatestCheckpoint(conversationId);

  // 如果没有 checkpoint，返回所有消息
  if (!checkpoint) {
    return getAllMessagesAsUIMessage(conversationId);
  }

  const db = getDb();

  // 获取 checkpoint 时间戳之后的消息
  const result = await db.execute({
    sql: `SELECT * FROM messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC`,
    args: [conversationId, checkpoint.created_at],
  });

  return result.rows.map(rowToUIMessage);
}

/**
 * 删除会话关联的所有 Checkpoint
 * 在删除会话时调用
 */
export async function deleteCheckpointsByConversation(
  conversationId: string
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM checkpoints WHERE conversation_id = ?`,
    args: [conversationId],
  });
}

// ==================== 辅助函数 ====================

/**
 * 获取会话所有消息并转换为 UIMessage 格式
 * 用于无缓存或缓存损坏时的消息加载
 * @param conversationId - 会话 ID
 * @returns 所有消息（UIMessage 格式）
 */
async function getAllMessagesAsUIMessage(conversationId: string): Promise<UIMessage[]> {
  // 从 messages 表获取所有消息
  const messages = await getMessages(conversationId);
  // 使用类型断言将 Message 转换为 Record<string, unknown> 格式
  // 实际运行时 Message 对象的字段与 Row 类型兼容
  return (messages as unknown as Record<string, unknown>[]).map(rowToUIMessage);
}

/**
 * 将数据库行转换为 UIMessage
 * 支持纯文本和 JSON 格式的消息内容
 * @param row - 数据库消息行（Row 类型）
 * @returns UIMessage 对象
 */
function rowToUIMessage(row: Record<string, unknown>): UIMessage {
  // 提取必要字段（兼容 Row 和 Message 类型）
  const id = row.id as string;
  const role = row.role as string;
  const content = row.content as string;

  try {
    // 尝试解析 JSON 格式的消息内容（新格式）
    const parsed = JSON.parse(content);
    return parsed as UIMessage;
  } catch {
    // JSON 解析失败，返回纯文本格式（兼容旧数据）
    return {
      id,
      role: role as "user" | "assistant",
      parts: [{ type: "text", text: content }],
    } as UIMessage;
  }
}

// ==================== 加载历史消息 ====================

/**
 * 加载历史消息（用于压缩执行和消息组装）
 * 逻辑：有 compression_cache 时用 cache + checkpoint 后的消息，否则用全部消息
 */
export async function loadHistoryMessages(
  conversationId: string
): Promise<UIMessage[]> {
  // 获取对话信息（包含 compression_cache）
  const dbConversation = await getConversation(conversationId);

  if (dbConversation?.compression_cache) {
    try {
      // 有缓存：cache.messages + 最新 checkpoint 之后的消息
      const cache = JSON.parse(dbConversation.compression_cache) as CompressionCache;
      const messagesAfterCheckpoint = await getMessagesAfterLatestCheckpoint(conversationId);

      // 合并：缓存消息 + checkpoint 之后的消息
      const historyMessages = [...(cache.messages as UIMessage[]), ...messagesAfterCheckpoint];

      return historyMessages;
    } catch (parseError) {
      // JSON 解析失败：cache 数据损坏，清除缓存后使用全部消息
      console.error("[压缩] compression_cache 解析失败:", parseError);
      await clearCompressionCache(conversationId);
    }
  }

  // 无缓存或缓存损坏：获取全部消息
  return getAllMessagesAsUIMessage(conversationId);
}

// ==================== 执行压缩 ====================

/**
 * 执行压缩任务
 * @param conversationId - 会话 ID
 * @returns 压缩结果：移除的消息数量
 */
export async function executeCompressionTask(
  conversationId: string
): Promise<{ removedCount: number }> {
  // 使用统一的加载历史消息逻辑
  const historyMessages = await loadHistoryMessages(conversationId);
  const originalMessageCount = historyMessages.length;

  // 计算移除数量（50%）
  let removeCount = Math.floor(historyMessages.length * 0.5);

  // 至少保留1条消息
  if (historyMessages.length - removeCount < 1) {
    removeCount = historyMessages.length - 1;
  }

  // 如果消息数量不足以压缩（少于2条），跳过压缩
  if (removeCount <= 0) {
    console.log("[执行压缩] 消息数量不足，跳过压缩:", { messageCount: historyMessages.length });
    return { removedCount: 0 };
  }

  // 移除最早的消息（数组前部）
  const compressedMessages = historyMessages.slice(removeCount);
  const compressedAt = Date.now();

  // 构造 cache_content（用于排查问题）
  const cacheContent: CompressionCache = {
    messages: compressedMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: msg.parts as unknown as MessagePart[],
    })),
    messageCount: originalMessageCount,
    removedCount: removeCount,
    compressedAt,
  };

  // 插入 Checkpoint（独立表），传入 cache_content 便于排查
  await createCheckpointRecord({
    conversationId,
    removedCount: removeCount,
    originalMessageCount: originalMessageCount,
    // 新增：存储压缩缓存内容，便于排查问题
    cacheContent: JSON.stringify(cacheContent),
  });

  // 更新 compression_cache
  await updateCompressionCache(conversationId, cacheContent);

  console.log("[执行压缩] 完成:", {
    originalCount: originalMessageCount,
    removedCount: removeCount,
    compressedCount: compressedMessages.length,
  });

  return {
    removedCount: removeCount,
  };
}

// ==================== 会话删除清理 ====================

/**
 * 清理会话关联的压缩数据
 * 在删除会话时调用
 */
export async function cleanupCompressionData(conversationId: string): Promise<void> {
  await deleteCompressionTasksByConversation(conversationId);
  await deleteCheckpointsByConversation(conversationId);
}