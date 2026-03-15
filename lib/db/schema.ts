/**
 * 数据库表结构定义
 * 用于Turso数据库初始化
 */

/**
 * users表 - 存储用户信息
 * is_anonymous: 是否匿名用户（0:认证用户, 1:匿名用户）
 */
export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  is_anonymous INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * conversations表 - 存储对话信息
 * agent_id: 关联的Agent ID，默认为 'production'
 * is_private: 是否私有对话（0:公开, 1:私有）
 */
export const CREATE_CONVERSATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  model TEXT,
  agent_id TEXT DEFAULT 'production',
  is_private INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * 迁移SQL：为现有conversations表添加agent_id字段
 * 用于数据库升级
 */
export const MIGRATION_ADD_AGENT_ID = `
ALTER TABLE conversations ADD COLUMN agent_id TEXT DEFAULT 'production';
`;

/**
 * 迁移SQL：为现有conversations表添加is_private字段
 */
export const MIGRATION_ADD_IS_PRIVATE = `
ALTER TABLE conversations ADD COLUMN is_private INTEGER DEFAULT 0;
`;

/**
 * messages表 - 存储消息记录
 * content字段存储完整消息内容：
 * - 纯文本消息：直接存储文本字符串
 * - 包含工具调用的消息：存储UIMessage的JSON字符串（包含parts数组）
 */
export const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
`;

/**
 * 创建索引以优化查询性能
 */
export const CREATE_INDEXES = [
  // 按用户ID查询对话列表
  `CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);`,
  // 按更新时间排序对话列表
  `CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);`,
  // 按对话ID查询消息
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);`,
  // 按创建时间排序消息
  `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`,
];

/**
 * 所有数据库初始化SQL语句
 */
export const INIT_SQL = [
  CREATE_CONVERSATIONS_TABLE,
  CREATE_MESSAGES_TABLE,
  ...CREATE_INDEXES,
];

/**
 * User类型定义
 * is_anonymous: 是否匿名用户
 */
export interface User {
  id: string;
  username: string | null;
  password_hash: string | null;
  is_anonymous: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * Conversation类型定义
 */
export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  model: string | null;
  // 关联的Agent ID，默认为 'production'
  agent_id: string;
  // 是否私有对话
  is_private: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * Message类型定义
 * content字段可以是：
 * - 纯文本字符串（历史数据兼容）
 * - JSON字符串，包含完整的UIMessage结构
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
}

/**
 * 消息Part类型定义（与AI SDK UIMessage.parts兼容）
 */
export type MessagePart = 
  | { type: "text"; text: string }
  | { type: `tool-${string}`; toolCallId: string; input: unknown; output: unknown; state: string; errorText?: string }
  | { type: "dynamic-tool"; toolName: string; toolCallId: string; input: unknown; output: unknown; state: string; errorText?: string }
  | { type: "step-start" };

/**
 * 完整消息结构（与AI SDK UIMessage兼容）
 */
export interface FullMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

/**
 * 创建对话的参数类型
 */
export interface CreateConversationParams {
  id: string;
  userId: string;
  title?: string;
  model?: string;
  // Agent ID，默认为 'production'
  agentId?: string;
  // 是否私有对话，默认为 false
  isPrivate?: boolean;
}

/**
 * 创建用户的参数类型
 */
export interface CreateUserParams {
  id: string;
  username?: string;
  passwordHash?: string;
  isAnonymous?: boolean;
}

/**
 * 创建消息的参数类型
 */
export interface CreateMessageParams {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
}

// ==================== 文档编辑页相关表结构 ====================

/**
 * folders表 - 存储文件夹信息
 * parent_id: 父文件夹ID，NULL表示根目录
 */
export const CREATE_FOLDERS_TABLE = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);
`;

/**
 * documents表 - 存储文档信息
 * folder_id: 所属文件夹ID，NULL表示根目录
 * content: 存储Tiptap JSON格式的文档内容
 */
export const CREATE_DOCUMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  folder_id TEXT,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
`;

/**
 * 文档系统索引
 */
export const CREATE_DOC_INDEXES = [
  // 按用户ID查询文件夹
  `CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);`,
  // 按父文件夹查询子文件夹
  `CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);`,
  // 按用户ID查询文档
  `CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);`,
  // 按文件夹查询文档
  `CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);`,
];

/**
 * Folder类型定义
 */
export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
  created_at: number;
  updated_at: number;
}

/**
 * Document类型定义
 */
export interface Document {
  id: string;
  title: string;
  content: string | null;
  folder_id: string | null;
  user_id: string;
  created_at: number;
  updated_at: number;
}

/**
 * 创建文件夹的参数类型
 */
export interface CreateFolderParams {
  id: string;
  name: string;
  parentId?: string | null;
  userId: string;
}

// ==================== 个人模型设置相关表结构 ====================

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
 * 个人模型设置索引
 */
export const CREATE_USER_MODEL_INDEXES = [
  // 按用户ID查询模型
  `CREATE INDEX IF NOT EXISTS idx_user_models_user_id ON user_models(user_id);`,
  // 按默认模型查询
  `CREATE INDEX IF NOT EXISTS idx_user_models_is_default ON user_models(is_default);`,
];

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
}
