/**
 * API Key 数据访问层
 * 提供 API Key 的创建、查询、删除操作
 */

import { getDb } from "./client";
import {
  type UserApiKey,
  type CreateUserApiKeyParams,
  type ApiKeyListItem,
} from "./schema";

/**
 * API Key 格式配置
 */
const API_KEY_PREFIX = "sk_live_";
const API_KEY_RANDOM_LENGTH = 32;

/**
 * 将数据库行转换为 UserApiKey 对象
 */
function mapRowToUserApiKey(row: Record<string, unknown>): UserApiKey {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    key_hash: row.key_hash as string,
    key_prefix: row.key_prefix as string,
    last_used_at: row.last_used_at as number | null,
    created_at: row.created_at as number,
  };
}

/**
 * 生成 API Key
 * 格式: sk_live_{32位随机字符串}
 * @returns 完整的 API Key（仅创建时可见）
 */
export function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomStr = "";
  for (let i = 0; i < API_KEY_RANDOM_LENGTH; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${API_KEY_PREFIX}${randomStr}`;
}

/**
 * 计算 API Key 的 SHA256 哈希
 * @param apiKey 完整的 API Key
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 提取 API Key 的前缀（用于展示）
 * 格式: sk_live_xxx...
 * @param apiKey 完整的 API Key
 */
export function getApiKeyPrefix(apiKey: string): string {
  // 取前缀 + 前 8 位随机字符
  return apiKey.substring(0, API_KEY_PREFIX.length + 8) + "...";
}

// ==================== CRUD 操作 ====================

/**
 * 创建新的 API Key
 * @param params 创建参数（不含 keyHash 和 keyPrefix）
 * @param apiKey 完整的 API Key（用于计算哈希）
 */
export async function createUserApiKey(
  params: Omit<CreateUserApiKeyParams, "keyHash" | "keyPrefix">,
  apiKey: string
): Promise<UserApiKey> {
  const db = getDb();
  const now = Date.now();

  // 计算哈希和前缀
  const keyHash = await hashApiKey(apiKey);
  const keyPrefix = getApiKeyPrefix(apiKey);

  await db.execute({
    sql: `INSERT INTO user_api_keys
          (id, user_id, name, key_hash, key_prefix, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.userId, params.name, keyHash, keyPrefix, now],
  });

  return {
    id: params.id,
    user_id: params.userId,
    name: params.name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    last_used_at: null,
    created_at: now,
  };
}

/**
 * 根据 ID 获取 API Key 详情
 */
export async function getUserApiKeyById(
  userId: string,
  apiKeyId: string
): Promise<UserApiKey | null> {
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT * FROM user_api_keys WHERE id = ? AND user_id = ?",
    args: [apiKeyId, userId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToUserApiKey(result.rows[0]);
}

/**
 * 获取用户的所有 API Key（列表形式，不含敏感信息）
 */
export async function getUserApiKeysByUserId(userId: string): Promise<ApiKeyListItem[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT id, name, key_prefix, last_used_at, created_at
          FROM user_api_keys
          WHERE user_id = ?
          ORDER BY created_at DESC`,
    args: [userId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    keyPrefix: row.key_prefix as string,
    lastUsedAt: row.last_used_at as number | null,
    createdAt: row.created_at as number,
  }));
}

/**
 * 删除 API Key
 */
export async function deleteUserApiKey(userId: string, apiKeyId: string): Promise<boolean> {
  const db = getDb();

  const result = await db.execute({
    sql: "DELETE FROM user_api_keys WHERE id = ? AND user_id = ?",
    args: [apiKeyId, userId],
  });

  return result.rowsAffected > 0;
}

/**
 * 通过 API Key 哈希验证并获取用户 ID
 * 同时更新 last_used_at
 */
export async function validateApiKey(keyHash: string): Promise<string | null> {
  const db = getDb();

  // 查询匹配的 API Key
  const result = await db.execute({
    sql: "SELECT id, user_id FROM user_api_keys WHERE key_hash = ?",
    args: [keyHash],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const apiKeyId = result.rows[0].id as string;
  const userId = result.rows[0].user_id as string;

  // 更新最后使用时间
  await db.execute({
    sql: "UPDATE user_api_keys SET last_used_at = ? WHERE id = ?",
    args: [Date.now(), apiKeyId],
  });

  return userId;
}