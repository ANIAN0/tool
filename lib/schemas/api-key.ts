/**
 * API Key 管理表结构定义
 */

// ==================== 表结构定义 ====================

/**
 * user_api_keys表 - 存储用户 API Key
 * key_hash: API Key 的 SHA256 哈希
 * key_prefix: Key 前缀（用于展示，如 sk_live_xxx）
 */
export const CREATE_USER_API_KEYS_TABLE = `
CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,           -- Key 名称（便于用户识别）
  key_hash TEXT NOT NULL,       -- API Key 的 SHA256 哈希
  key_prefix TEXT NOT NULL,     -- Key 前缀（用于展示）
  last_used_at INTEGER,         -- 最后使用时间
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

/**
 * API Key 相关索引
 */
export const CREATE_API_KEYS_INDEXES = [
  // 按用户 ID 查询 API Key
  `CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);`,
  // 按 Key 哈希快速查找（鉴权时使用）
  `CREATE INDEX IF NOT EXISTS idx_user_api_keys_key_hash ON user_api_keys(key_hash);`,
];

// ==================== 类型定义 ====================

/**
 * UserApiKey 类型定义
 * 用户的 API Key
 */
export interface UserApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: number | null;
  created_at: number;
}

/**
 * 创建 API Key 的参数类型
 */
export interface CreateUserApiKeyParams {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
}

/**
 * API Key 列表响应类型（不含敏感信息）
 */
export interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: number | null;
  createdAt: number;
}