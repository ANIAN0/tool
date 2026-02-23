import { getDb } from "./client";
import type { Conversation, CreateConversationParams } from "./schema";
import { DEFAULT_AGENT_ID } from "../agents/config";

/**
 * 将数据库行转换为Conversation类型
 */
function rowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    title: row.title as string | null,
    model: row.model as string | null,
    // agent_id 默认为 'production'
    agent_id: (row.agent_id as string) || DEFAULT_AGENT_ID,
    // is_private 默认为 false
    is_private: Boolean(row.is_private),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

/**
 * 创建新对话
 * @param params - 创建对话的参数
 * @returns 新创建的对话记录
 */
export async function createConversation(
  params: CreateConversationParams
): Promise<Conversation> {
  const db = getDb();
  const now = Date.now();
  // 获取 agentId，默认为正式Agent
  const agentId = params.agentId || DEFAULT_AGENT_ID;
  // 获取 isPrivate，默认为 false
  const isPrivate = params.isPrivate ? 1 : 0;

  // 插入对话记录
  await db.execute({
    sql: `INSERT INTO conversations (id, user_id, title, model, agent_id, is_private, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.userId,
      params.title ?? null,
      params.model ?? null,
      agentId,
      isPrivate,
      now,
      now,
    ],
  });

  // 返回创建的对话
  return {
    id: params.id,
    user_id: params.userId,
    title: params.title ?? null,
    model: params.model ?? null,
    agent_id: agentId,
    is_private: Boolean(isPrivate),
    created_at: now,
    updated_at: now,
  };
}

/**
 * 获取用户的所有对话列表
 * @param userId - 用户ID
 * @returns 对话列表，按更新时间倒序排列
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM conversations 
          WHERE user_id = ? 
          ORDER BY updated_at DESC`,
    args: [userId],
  });

  return result.rows.map(rowToConversation);
}

/**
 * 获取单个对话详情
 * @param id - 对话ID
 * @returns 对话记录，不存在则返回null
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM conversations WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToConversation(result.rows[0]);
}

/**
 * 更新对话信息
 * @param id - 对话ID
 * @param data - 要更新的数据
 * @returns 更新后的对话记录，不存在则返回null
 */
export async function updateConversation(
  id: string,
  data: { title?: string; model?: string }
): Promise<Conversation | null> {
  const db = getDb();

  const now = Date.now();
  const updates: string[] = ["updated_at = ?"];
  const args: (string | number | null)[] = [now];

  // 构建动态更新语句
  if (data.title !== undefined) {
    updates.push("title = ?");
    args.push(data.title);
  }

  if (data.model !== undefined) {
    updates.push("model = ?");
    args.push(data.model);
  }

  args.push(id);

  // 直接执行更新，通过受影响行数判断是否存在
  const result = await db.execute({
    sql: `UPDATE conversations SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  // 检查是否有行被更新
  if (result.rowsAffected === 0) {
    return null;
  }

  // 返回更新后的对话（重新查询以获取完整数据）
  return getConversation(id);
}

/**
 * 删除对话
 * @param id - 对话ID
 * @returns 是否删除成功
 */
export async function deleteConversation(id: string): Promise<boolean> {
  const db = getDb();

  // 直接删除，通过受影响行数判断是否成功
  const result = await db.execute({
    sql: `DELETE FROM conversations WHERE id = ?`,
    args: [id],
  });

  return result.rowsAffected > 0;
}

/**
 * 更新对话的更新时间
 * 用于发送新消息后更新对话时间戳
 * @param id - 对话ID
 */
export async function touchConversation(id: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE conversations SET updated_at = ? WHERE id = ?`,
    args: [Date.now(), id],
  });
}
