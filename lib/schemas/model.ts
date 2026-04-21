/**
 * 用户模型配置表结构定义
 */

// ==================== 表结构定义 ====================

/**
 * user_models表 - 存储用户自定义模型配置
 * provider: 模型提供商 (openai, anthropic, google, custom等)
 * api_key: 加密存储的API密钥
 * base_url: 可选的自定义API基础URL
 * is_default: 是否为默认模型
 */
export const CREATE_USER_MODELS_TABLE = `
CREATE TABLE IF NOT EXISTS user_models (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT,
  is_default INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

/**
 * 迁移SQL：为 user_models 表添加 context_limit 字段
 * 用于存储模型上下文上限（token数）
 */
export const MIGRATION_ADD_CONTEXT_LIMIT = `
ALTER TABLE user_models ADD COLUMN context_limit INTEGER DEFAULT 32000;
`;

/**
 * 个人模型设置索引
 */
export const CREATE_USER_MODEL_INDEXES = [
  // 按用户ID查询模型
  `CREATE INDEX IF NOT EXISTS idx_user_models_user_id ON user_models(user_id);`,
  // 按默认模型查询
  `CREATE INDEX IF NOT EXISTS idx_user_models_is_default ON user_models(is_default);`,
];

// ==================== 类型定义 ====================

/**
 * UserModel类型定义
 * 用户自定义LLM模型配置
 */
export interface UserModel {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  model: string;
  api_key: string;
  base_url: string | null;
  is_default: boolean;
  context_limit: number; // 模型上下文上限（token数）
  created_at: number;
  updated_at: number;
}

/**
 * 创建用户模型的参数类型
 */
export interface CreateUserModelParams {
  id: string;
  userId: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isDefault?: boolean;
  contextLimit?: number; // 上下文上限，默认 32000
}

/**
 * 更新用户模型的参数类型
 */
export interface UpdateUserModelParams {
  name?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string | null;
  isDefault?: boolean;
  contextLimit?: number;
}