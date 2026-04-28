import { cache } from "react";
import { getDb } from "./client";
import type { Conversation, CreateConversationParams, CompressionCache } from "./schema";

/**
 * 将数据库行转换为Conversation类型
 */
function rowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    title: row.title as string | null,
    model: row.model as string | null,
    // agent_id 使用数据库默认值（已迁移时设置）
    agent_id: row.agent_id as string,
    // is_private 默认为 false
    is_private: Boolean(row.is_private),
    // source 默认为 'chat'（兼容旧数据）
    source: (row.source as string) || 'chat',
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    // Token汇总字段
    total_input_tokens: (row.total_input_tokens as number) ?? 0,
    total_output_tokens: (row.total_output_tokens as number) ?? 0,
    total_tokens: (row.total_tokens as number) ?? 0,
    // 压缩缓存字段
    compression_cache: row.compression_cache as string | null ?? null,
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
  // agentId 必须显式传入（前端已强制要求）
  const agentId = params.agentId;
  // 获取 isPrivate，默认为 false
  const isPrivate = params.isPrivate ? 1 : 0;
  // 获取 source，默认为 'chat'
  const source = params.source || 'chat';

  // 插入对话记录
  await db.execute({
    sql: `INSERT INTO conversations (id, user_id, title, model, agent_id, is_private, source, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.userId,
      params.title ?? null,
      params.model ?? null,
      agentId,
      isPrivate,
      source,
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
    source,
    created_at: now,
    updated_at: now,
    // Token汇总字段初始化为0
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_tokens: 0,
    // 压缩缓存初始化为 null
    compression_cache: null,
  };
}

/**
 * 获取用户的所有对话列表
 * 🚀 性能优化：使用 React.cache() 缓存查询结果
 * @param userId - 用户ID
 * @returns 对话列表，按更新时间倒序排列
 */
export const getConversations = cache(async (userId: string): Promise<Conversation[]> => {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM conversations
          WHERE user_id = ?
          ORDER BY updated_at DESC`,
    args: [userId],
  });

  return result.rows.map(rowToConversation);
});

/**
 * 获取用户的所有对话列表（支持source过滤）
 * 🚀 性能优化：使用 React.cache() 缓存查询结果
 * @param userId - 用户ID
 * @param options - 可选的过滤选项
 * @returns 对话列表，按更新时间倒序排列
 */
export const getConversationsWithFilter = cache(async (
  userId: string,
  options?: { source?: string }
): Promise<Conversation[]> => {
  const db = getDb();

  // 构建SQL查询
  let sql = `SELECT * FROM conversations WHERE user_id = ?`;
  const args: string[] = [userId];

  // 如果指定了source过滤
  if (options?.source) {
    sql += ` AND source = ?`;
    args.push(options.source);
  } else {
    // 未指定source时，兼容旧数据（source IS NULL 或 source = 'chat'）
    sql += ` AND (source IS NULL OR source = 'chat')`;
  }

  sql += ` ORDER BY updated_at DESC`;

  const result = await db.execute({ sql, args });
  return result.rows.map(rowToConversation);
});

/**
 * 获取单个对话详情
 * 🚀 性能优化：使用 React.cache() 缓存查询结果
 * @param id - 对话ID
 * @returns 对话记录，不存在则返回null
 */
export const getConversation = cache(async (id: string): Promise<Conversation | null> => {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM conversations WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToConversation(result.rows[0]);
});

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

/**
 * 更新对话的 token 汇总
 * 每次助手回复后累加 token 使用量
 * @param conversationId - 对话ID
 * @param usage - token 使用统计
 */
export async function updateConversationTokenTotals(
  conversationId: string,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE conversations
          SET total_input_tokens = total_input_tokens + ?,
              total_output_tokens = total_output_tokens + ?,
              total_tokens = total_tokens + ?
          WHERE id = ?`,
    args: [
      usage.inputTokens || 0,
      usage.outputTokens || 0,
      usage.totalTokens || 0,
      conversationId,
    ],
  });
}

/**
 * 更新对话的压缩缓存
 * 压缩完成后存储压缩后的消息快照
 * @param conversationId - 对话ID
 * @param cache - 压缩缓存数据
 */
export async function updateCompressionCache(
  conversationId: string,
  cache: CompressionCache
): Promise<void> {
  const db = getDb();

  // 将缓存对象序列化为 JSON 字符串存储
  const cacheJson = JSON.stringify(cache);

  await db.execute({
    sql: `UPDATE conversations SET compression_cache = ? WHERE id = ?`,
    args: [cacheJson, conversationId],
  });
}

/**
 * 清除对话的压缩缓存
 * 用户手动删除消息后需要清除缓存，下次请求重新计算
 * @param conversationId - 对话ID
 */
export async function clearCompressionCache(
  conversationId: string
): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE conversations SET compression_cache = NULL WHERE id = ?`,
    args: [conversationId],
  });
}
