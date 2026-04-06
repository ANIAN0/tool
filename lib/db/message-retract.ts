/**
 * 消息撤回模块
 * 支持级联删除和归档
 */

import { getDb } from "./client";
import type { DeletedMessage, Message } from "./schema";

/**
 * 撤回消息结果
 */
export interface RetractMessageResult {
  /** 删除的消息数量 */
  deletedCount: number;
  /** 对话ID */
  conversationId: string;
}

/**
 * 撤回单条消息（级联删除）
 * 使用数据库事务保证归档和删除的原子性
 *
 * @param messageId - 要删除的消息ID
 * @param userId - 操作用户ID
 * @param reason - 删除原因
 * @returns 删除的消息数量和对话ID
 */
export async function retractMessage(
  messageId: string,
  userId: string,
  reason: "user-delete" | "edit-regenerate"
): Promise<RetractMessageResult> {
  const db = getDb();
  const now = Date.now();

  // 查询目标消息
  const targetMessage = await db.execute({
    sql: `SELECT * FROM messages WHERE id = ?`,
    args: [messageId],
  });

  // 消息已经不存在，可能已被其他操作删除（幂等性处理）
  // 返回 deletedCount=0 和空 conversationId
  if (targetMessage.rows.length === 0) {
    return {
      deletedCount: 0,
      conversationId: "",
    };
  }

  const targetCreatedAt = targetMessage.rows[0].created_at as number;
  const conversationId = targetMessage.rows[0].conversation_id as string;

  // 验证对话所有权
  const conversation = await db.execute({
    sql: `SELECT user_id FROM conversations WHERE id = ?`,
    args: [conversationId],
  });

  if (conversation.rows.length === 0) {
    throw new Error("对话不存在");
  }

  if (conversation.rows[0].user_id !== userId) {
    throw new Error("无权操作此消息");
  }

  // 查询后续消息（包含目标消息本身）
  const subsequentMessages = await db.execute({
    sql: `SELECT * FROM messages WHERE conversation_id = ? AND created_at >= ? ORDER BY created_at ASC`,
    args: [conversationId, targetCreatedAt],
  });

  const messagesToDelete = subsequentMessages.rows;
  const deletedCount = messagesToDelete.length;

  // 如果没有消息需要删除，直接返回
  if (deletedCount === 0) {
    return {
      deletedCount: 0,
      conversationId,
    };
  }

  // 执行事务：归档 + 删除
  // 使用 batch 执行多条语句，保证原子性
  const statements = [];

  // 生成归档插入语句
  for (const msg of messagesToDelete) {
    statements.push({
      sql: `INSERT INTO deleted_messages (id, conversation_id, role, content, original_created_at, deleted_at, deleted_reason, deleted_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        msg.id,
        msg.conversation_id,
        msg.role,
        msg.content,
        msg.created_at,
        now,
        reason,
        userId,
      ],
    });
  }

  // 生成删除语句
  for (const msg of messagesToDelete) {
    statements.push({
      sql: `DELETE FROM messages WHERE id = ?`,
      args: [msg.id],
    });
  }

  // 批量执行（事务保证原子性）
  await db.batch(statements);

  return {
    deletedCount,
    conversationId,
  };
}

/**
 * 编辑消息并重新生成（级联删除后续消息）
 * @param messageId - 要编辑的消息ID
 * @param newContent - 新的消息内容（JSON格式的UIMessage）
 * @param userId - 操作用户ID
 * @returns 更新后的消息对象
 */
export async function editAndRegenerate(
  messageId: string,
  newContent: string,
  userId: string
): Promise<Message> {
  const db = getDb();
  const now = Date.now();

  // 查询目标消息
  const targetMessage = await db.execute({
    sql: `SELECT * FROM messages WHERE id = ?`,
    args: [messageId],
  });

  if (targetMessage.rows.length === 0) {
    throw new Error("消息不存在");
  }

  const msg = targetMessage.rows[0];
  if (msg.role !== "user") {
    throw new Error("只能编辑用户消息");
  }

  const targetCreatedAt = msg.created_at as number;
  const conversationId = msg.conversation_id as string;

  // 验证对话所有权
  const conversation = await db.execute({
    sql: `SELECT user_id FROM conversations WHERE id = ?`,
    args: [conversationId],
  });

  if (conversation.rows.length === 0) {
    throw new Error("对话不存在");
  }

  if (conversation.rows[0].user_id !== userId) {
    throw new Error("无权操作此消息");
  }

  // 查询后续消息（不包含目标消息本身）
  const subsequentMessages = await db.execute({
    sql: `SELECT * FROM messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC`,
    args: [conversationId, targetCreatedAt],
  });

  // 执行事务：归档后续消息 + 删除后续消息 + 更新目标消息
  const statements = [];

  // 归档后续消息
  for (const subMsg of subsequentMessages.rows) {
    statements.push({
      sql: `INSERT INTO deleted_messages (id, conversation_id, role, content, original_created_at, deleted_at, deleted_reason, deleted_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        subMsg.id,
        subMsg.conversation_id,
        subMsg.role,
        subMsg.content,
        subMsg.created_at,
        now,
        "edit-regenerate",
        userId,
      ],
    });
  }

  // 删除后续消息
  for (const subMsg of subsequentMessages.rows) {
    statements.push({
      sql: `DELETE FROM messages WHERE id = ?`,
      args: [subMsg.id],
    });
  }

  // 更新目标消息内容
  statements.push({
    sql: `UPDATE messages SET content = ? WHERE id = ?`,
    args: [newContent, messageId],
  });

  // 批量执行（事务）
  await db.batch(statements);

  // 返回更新后的消息
  return {
    id: messageId,
    conversation_id: conversationId,
    role: "user",
    content: newContent,
    created_at: msg.created_at as number,
  };
}

/**
 * 获取对话的归档消息列表
 * @param conversationId - 对话ID
 * @returns 归档消息列表
 */
export async function getDeletedMessages(
  conversationId: string
): Promise<DeletedMessage[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM deleted_messages WHERE conversation_id = ? ORDER BY original_created_at ASC`,
    args: [conversationId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    role: row.role as "user" | "assistant",
    content: row.content as string,
    original_created_at: row.original_created_at as number,
    deleted_at: row.deleted_at as number,
    deleted_reason: row.deleted_reason as "user-delete" | "edit-regenerate" | null,
    deleted_by: row.deleted_by as string,
  }));
}