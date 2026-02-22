import { getDb } from "./client";
import type { Message, CreateMessageParams } from "./schema";

/**
 * 将数据库行转换为Message类型
 */
function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    role: row.role as "user" | "assistant",
    content: row.content as string,
    created_at: row.created_at as number,
  };
}

/**
 * 创建新消息
 * @param params - 创建消息的参数
 * @returns 新创建的消息记录
 */
export async function createMessage(params: CreateMessageParams): Promise<Message> {
  const db = getDb();
  const now = Date.now();

  // 插入消息记录
  await db.execute({
    sql: `INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [params.id, params.conversationId, params.role, params.content, now],
  });

  // 返回创建的消息
  return {
    id: params.id,
    conversation_id: params.conversationId,
    role: params.role,
    content: params.content,
    created_at: now,
  };
}

/**
 * 获取对话的所有消息
 * @param conversationId - 对话ID
 * @returns 消息列表，按创建时间升序排列
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM messages 
          WHERE conversation_id = ? 
          ORDER BY created_at ASC`,
    args: [conversationId],
  });

  return result.rows.map(rowToMessage);
}

/**
 * 删除对话的所有消息
 * @param conversationId - 对话ID
 * @returns 删除的消息数量
 */
export async function deleteMessagesByConversation(
  conversationId: string
): Promise<number> {
  const db = getDb();

  // 先获取消息数量
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`,
    args: [conversationId],
  });

  const count = countResult.rows[0]?.count as number;

  // 删除消息
  await db.execute({
    sql: `DELETE FROM messages WHERE conversation_id = ?`,
    args: [conversationId],
  });

  return count;
}
