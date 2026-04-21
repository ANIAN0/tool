/**
 * 对话和消息表结构定义
 * messages与conversations强关联，合并到同一文件便于维护
 */

// ==================== 表结构定义 ====================

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
 * 迁移SQL：为现有conversations表添加source字段
 * 用于区分对话来源：chat页面 或 agent-chat页面
 */
export const MIGRATION_ADD_SOURCE = `
ALTER TABLE conversations ADD COLUMN source TEXT DEFAULT 'chat';
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
 * 迁移SQL：为 messages 表添加 token 统计字段
 * 仅 assistant 消息有值，user 消息为 NULL
 */
export const MIGRATION_ADD_MESSAGE_TOKEN_FIELDS = `
ALTER TABLE messages ADD COLUMN input_tokens INTEGER;
ALTER TABLE messages ADD COLUMN output_tokens INTEGER;
ALTER TABLE messages ADD COLUMN total_tokens INTEGER;
`;

/**
 * 迁移SQL：为 conversations 表添加 token 汇总字段
 */
export const MIGRATION_ADD_CONVERSATION_TOKEN_FIELDS = `
ALTER TABLE conversations ADD COLUMN total_input_tokens INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN total_output_tokens INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN total_tokens INTEGER DEFAULT 0;
`;

/**
 * 迁移SQL：为 conversations 表添加 compression_cache 字段
 * 用于存储会话压缩缓存
 */
export const MIGRATION_ADD_COMPRESSION_CACHE = `
ALTER TABLE conversations ADD COLUMN compression_cache TEXT;
`;

/**
 * 迁移SQL：为 messages 表添加 type 字段
 * 用于区分普通消息和 checkpoint 消息
 */
export const MIGRATION_ADD_MESSAGE_TYPE = `
ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'normal';
`;

/**
 * 创建索引以优化查询性能
 */
export const CREATE_CONVERSATION_INDEXES = [
  // 按用户ID查询对话列表
  `CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);`,
  // 按更新时间排序对话列表
  `CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);`,
  // 按对话ID查询消息
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);`,
  // 按创建时间排序消息
  `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`,
];

// ==================== 类型定义 ====================

/**
 * Conversation类型定义
 *
 * Token汇总字段：
 * - total_input_tokens: 对话累计输入token
 * - total_output_tokens: 对话累计输出token
 * - total_tokens: 对话累计总token
 *
 * 压缩缓存字段：
 * - compression_cache: 会话压缩缓存（JSON字符串）
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
  // 对话来源：'chat' 或 'agent-chat'
  source: string;
  created_at: number;
  updated_at: number;
  // Token汇总字段
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  // 压缩缓存（JSON: CompressionCache）
  compression_cache: string | null;
}

/**
 * Message类型定义
 * content字段可以是：
 * - 纯文本字符串（历史数据兼容）
 * - JSON字符串，包含完整的UIMessage结构
 *
 * Token统计字段（仅assistant消息有值）：
 * - input_tokens: 输入token数
 * - output_tokens: 输出token数
 * - total_tokens: 总token数
 *
 * 消息类型：
 * - type: 'normal' - 普通消息，'checkpoint' - 压缩检查点
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: number;
  // Token统计字段（仅assistant消息有值）
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  // 消息类型：normal 或 checkpoint
  type?: "normal" | "checkpoint";
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
  // 对话来源，默认为 'chat'
  source?: string;
}

/**
 * 创建消息的参数类型
 */
export interface CreateMessageParams {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  // Token统计字段（可选，仅assistant消息使用）
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}