/**
 * 系统相关表结构定义
 * 包括压缩任务、检查点、消息撤回等
 */

// ==================== 异步压缩表结构 ====================

/**
 * compression_tasks 表 - 存储压缩任务
 * 用于异步压缩任务调度
 * status: 0 - pending（未处理）, 1 - completed（已完成）
 */
export const CREATE_COMPRESSION_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS compression_tasks (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  status INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
`;

/**
 * 唯一索引：每个会话只能有 1 个未处理的压缩任务
 * SQLite 3.8.0+ 支持 filtered index（WHERE 子句）
 */
export const CREATE_COMPRESSION_TASKS_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_compression_tasks_pending_unique
   ON compression_tasks(conversation_id, status)
   WHERE status = 0;`,
];

/**
 * checkpoints 表 - 存储压缩检查点
 * checkpoint 是压缩元数据，不再作为消息存储
 */
export const CREATE_CHECKPOINTS_TABLE = `
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  removed_count INTEGER NOT NULL,
  original_message_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
`;

/**
 * 迁移SQL：为 checkpoints 表添加 cache_content 字段
 * 用于存储 compression_cache 的完整内容，便于排查问题
 */
export const MIGRATION_ADD_CHECKPOINT_CACHE_CONTENT = `
ALTER TABLE checkpoints ADD COLUMN cache_content TEXT;
`;

/**
 * checkpoints 表索引
 */
export const CREATE_CHECKPOINTS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_checkpoints_conversation
   ON checkpoints(conversation_id, created_at DESC);`,
];

// ==================== 消息撤回表结构 ====================

/**
 * deleted_messages表 - 存储被撤回的消息归档
 * 用于消息撤回功能，保持主表查询性能
 */
export const CREATE_DELETED_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS deleted_messages (
  id TEXT PRIMARY KEY,                 -- 原消息ID
  conversation_id TEXT NOT NULL,       -- 原对话ID
  role TEXT NOT NULL,                  -- 原消息角色（user/assistant）
  content TEXT NOT NULL,               -- 原消息内容（JSON格式）
  original_created_at INTEGER NOT NULL, -- 原创建时间
  deleted_at INTEGER NOT NULL,         -- 删除时间戳
  deleted_reason TEXT,                 -- 删除原因：'user-delete' 或 'edit-regenerate'
  deleted_by TEXT NOT NULL             -- 删除操作者（用户ID）
);
`;

/**
 * 归档表索引
 */
export const CREATE_DELETED_MESSAGES_INDEXES = [
  // 按对话ID查询归档消息
  `CREATE INDEX IF NOT EXISTS idx_deleted_messages_conversation_id ON deleted_messages(conversation_id);`,
  // 按删除时间查询
  `CREATE INDEX IF NOT EXISTS idx_deleted_messages_deleted_at ON deleted_messages(deleted_at);`,
];

// ==================== 类型定义 ====================

/**
 * 压缩任务状态枚举
 */
export enum CompressionTaskStatus {
  Pending = 0,    // 未处理
  Completed = 1,  // 已完成
}

/**
 * CompressionTask 类型定义
 */
export interface CompressionTask {
  id: string;
  conversation_id: string;
  status: CompressionTaskStatus;
  created_at: number;
  completed_at: number | null;
}

/**
 * Checkpoint 类型定义（独立表）
 * cache_content: 存储 compression_cache 的完整内容（JSON字符串）
 */
export interface Checkpoint {
  id: string;
  conversation_id: string;
  removed_count: number;
  original_message_count: number;
  created_at: number;
  // 压缩缓存内容（JSON字符串），用于排查问题
  cache_content?: string | null;
}

/**
 * 创建压缩任务的参数类型
 */
export interface CreateCompressionTaskParams {
  id: string;
  conversationId: string;
}

/**
 * 创建 Checkpoint 记录的参数类型
 * 使用 CreateCheckpointRecordParams 以避免与现有 CreateCheckpointParams 冲突
 */
export interface CreateCheckpointRecordParams {
  conversationId: string;
  removedCount: number;
  originalMessageCount: number;
  // 压缩缓存内容（JSON字符串），用于排查
  cacheContent?: string;
}

/**
 * DeletedMessage 类型定义
 * 被撤回的消息归档记录
 */
export interface DeletedMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  original_created_at: number;
  deleted_at: number;
  deleted_reason: "user-delete" | "edit-regenerate" | null;
  deleted_by: string;
}

/**
 * 创建归档消息的参数类型
 */
export interface CreateDeletedMessageParams {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  originalCreatedAt: number;
  deletedReason?: "user-delete" | "edit-regenerate";
  deletedBy: string;
}

/**
 * 压缩缓存类型定义
 * 存储在 conversation.compression_cache 字段中
 */
export interface CompressionCache {
  /** 压缩后的消息快照 */
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    parts: Array<{
      type: string;
      text?: string;
      toolCallId?: string;
      input?: unknown;
      output?: unknown;
      state?: string;
      errorText?: string;
    }>;
  }>;
  /** 压缩时的消息总数 */
  messageCount: number;
  /** 被移除的消息数量 */
  removedCount: number;
  /** 压缩时间戳 */
  compressedAt: number;
}

/**
 * Checkpoint 消息内容类型定义（旧格式，用于兼容历史数据）
 * 旧方案中存储在 message.content 字段中（type 为 checkpoint 时）
 * 新方案使用独立的 checkpoints 表存储
 */
export interface CheckpointContent {
  type: "checkpoint";
  /** 被移除的消息数量 */
  removedCount: number;
  /** 压缩前的消息总数 */
  originalMessageCount: number;
  /** 压缩时间戳 */
  compressedAt: number;
}