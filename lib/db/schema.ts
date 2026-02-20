/**
 * 数据库表结构定义
 * 用于Turso数据库初始化
 */

/**
 * conversations表 - 存储对话信息
 */
export const CREATE_CONVERSATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * messages表 - 存储消息记录
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
 * Conversation类型定义
 */
export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Message类型定义
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
}

/**
 * 创建对话的参数类型
 */
export interface CreateConversationParams {
  id: string;
  userId: string;
  title?: string;
  model?: string;
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
