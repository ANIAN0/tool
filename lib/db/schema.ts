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
  // Token统计字段（可选，仅assistant消息使用）
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
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

/**
 * 创建文档的参数类型
 */
export interface CreateDocumentParams {
  id: string;
  title: string;
  content?: string;
  folderId?: string | null;
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
 * 迁移SQL：为 user_models 表添加 context_limit 字段
 * 用于存储模型上下文上限（token数）
 */
export const MIGRATION_ADD_CONTEXT_LIMIT = `
ALTER TABLE user_models ADD COLUMN context_limit INTEGER DEFAULT 32000;
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
 * 迁移SQL：为 checkpoints 表添加 cache_content 字段
 * 用于存储 compression_cache 的完整内容，便于排查问题
 */
export const MIGRATION_ADD_CHECKPOINT_CACHE_CONTENT = `
ALTER TABLE checkpoints ADD COLUMN cache_content TEXT;
`;

// ==================== 异步会话压缩相关表结构 ====================

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
 * checkpoints 表索引
 */
export const CREATE_CHECKPOINTS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_checkpoints_conversation
   ON checkpoints(conversation_id, created_at DESC);`,
];

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

// ==================== MCP 服务器管理相关表结构 ====================

/**
 * user_mcp_servers表 - 存储用户配置的MCP服务器
 * status: 服务器状态 (online-在线, offline-离线, error-错误)
 * name: 服务器名称
 * url: MCP服务器URL (存储原始URL，展示时脱敏)
 * is_enabled: 是否启用
 * last_check_at: 上次状态检查时间戳
 * error_message: 错误信息（当status为error时）
 */
export const CREATE_USER_MCP_SERVERS_TABLE = `
CREATE TABLE IF NOT EXISTS user_mcp_servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT,  -- 新增：存储 JSON 格式的 headers
  status TEXT DEFAULT 'offline',
  is_enabled INTEGER DEFAULT 1,
  last_check_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

/**
 * mcp_tools表 - 存储MCP服务器提供的工具缓存
 * server_id: 关联的MCP服务器ID
 * name: 工具名称
 * description: 工具描述
 * input_schema: 工具输入参数的JSON Schema
 * is_available: 工具是否可用（服务器离线时为false）
 */
export const CREATE_MCP_TOOLS_TABLE = `
CREATE TABLE IF NOT EXISTS mcp_tools (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  input_schema TEXT,
  is_available INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES user_mcp_servers(id) ON DELETE CASCADE
);
`;

/**
 * MCP服务器相关索引
 */
export const CREATE_MCP_SERVERS_INDEXES = [
  // 按用户ID查询MCP服务器
  `CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_user_id ON user_mcp_servers(user_id);`,
  // 按状态查询MCP服务器
  `CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_status ON user_mcp_servers(status);`,
  // 按服务器ID查询工具
  `CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_id ON mcp_tools(server_id);`,
];

/**
 * MCP服务器类型定义
 */
export interface McpServer {
  id: string;
  user_id: string;
  name: string;
  url: string;
  headers: string | null;  // 新增：JSON 格式的 headers
  status: McpStatus;
  is_enabled: boolean;
  last_check_at: number | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * MCP服务器状态类型
 */
export type McpStatus = 'online' | 'offline' | 'error';

/**
 * MCP服务器状态检查结果
 */
export interface McpStatusResult {
  // 服务器是否可连接
  online: boolean;
  // 服务器返回的错误信息（如果有）
  error?: string;
  // 服务器响应时间（毫秒）
  responseTime?: number;
  // 服务器提供的工具数量
  toolsCount?: number;
}

/**
 * MCP工具类型定义（数据库中存储的原始格式）
 */
export interface McpTool {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  // 输入参数的JSON Schema，存储为JSON字符串
  input_schema: string | null;
  is_available: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * 系统内置工具类型定义
 */
export interface SystemTool {
  // 工具唯一标识
  id: string;
  // 工具名称
  name: string;
  // 工具描述
  description: string;
  // 工具输入参数的JSON Schema
  inputSchema: Record<string, unknown>;
  // 是否为系统工具（固定为true）
  isSystem: true;
}

/**
 * 统一工具类型（用于前端展示）
 * 可以是系统工具或MCP提供的工具
 */
export interface Tool {
  // 工具唯一标识
  id: string;
  // 工具名称
  name: string;
  // 工具描述
  description: string;
  // 工具输入参数的JSON Schema
  inputSchema: Record<string, unknown>;
  // 工具来源：system-系统工具，mcp-MCP服务器
  source: 'system' | 'mcp';
  // 所属MCP服务器信息（仅source为mcp时有值）
  server?: {
    id: string;
    name: string;
  };
  // 工具是否可用
  isAvailable: boolean;
}

/**
 * 创建MCP服务器的参数类型
 */
export interface CreateMcpServerParams {
  id: string;
  userId: string;
  name: string;
  url: string;
  headers?: string;  // 新增：JSON 格式的 headers
}

/**
 * 更新MCP服务器的参数类型
 */
export interface UpdateMcpServerParams {
  name?: string;
  url?: string;
  isEnabled?: boolean;
  headers?: string;  // 新增：JSON 格式的 headers
}

// ==================== Agent配置管理相关表结构 ====================

/**
 * agents表 - 存储用户自定义Agent配置
 * user_id: 创建者用户ID
 * template_id: Agent模板ID（如 basic-loop）
 * template_config: 模板配置参数JSON
 * system_prompt: 系统提示词
 * model_id: 关联的用户模型ID
 * is_public: 是否公开（0:私有, 1:公开）
 */
export const CREATE_AGENTS_TABLE = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_id TEXT NOT NULL,
  template_config TEXT,
  system_prompt TEXT,
  model_id TEXT,
  is_public INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

/**
 * agent_tools表 - Agent与MCP工具的多对多关联
 */
export const CREATE_AGENT_TOOLS_TABLE = `
CREATE TABLE IF NOT EXISTS agent_tools (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id) REFERENCES mcp_tools(id) ON DELETE CASCADE,
  UNIQUE(agent_id, tool_id)
);
`;

/**
 * Agent配置相关索引
 */
export const CREATE_AGENTS_INDEXES = [
  // 按用户ID查询Agent
  `CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);`,
  // 按公开状态查询Agent
  `CREATE INDEX IF NOT EXISTS idx_agents_is_public ON agents(is_public);`,
  // 按Agent ID查询工具关联
  `CREATE INDEX IF NOT EXISTS idx_agent_tools_agent_id ON agent_tools(agent_id);`,
  // 按工具ID查询关联的Agent
  `CREATE INDEX IF NOT EXISTS idx_agent_tools_tool_id ON agent_tools(tool_id);`,
];

/**
 * Agent类型定义
 */
export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_id: string;
  template_config: string | null;
  system_prompt: string | null;
  model_id: string | null;
  is_public: boolean;
  // 启用的系统工具ID列表（JSON字符串）
  enabled_system_tools: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Agent工具关联类型定义
 */
export interface AgentTool {
  id: string;
  agent_id: string;
  tool_id: string;
  created_at: number;
}

/**
 * 创建Agent的参数类型
 */
export interface CreateAgentParams {
  id: string;
  userId: string;
  name: string;
  description?: string;
  templateId: string;
  templateConfig?: Record<string, unknown>;
  systemPrompt?: string;
  modelId?: string;
  toolIds?: string[];
  // 启用的系统工具ID列表
  enabledSystemTools?: string[];
  // 关联的 Skill ID 列表
  skillIds?: string[];
}

/**
 * 更新Agent的参数类型
 */
export interface UpdateAgentParams {
  name?: string;
  description?: string | null;
  templateId?: string;
  templateConfig?: Record<string, unknown>;
  systemPrompt?: string | null;
  modelId?: string | null;
  toolIds?: string[];
  // 启用的系统工具ID列表
  enabledSystemTools?: string[];
  // 关联的 Skill ID 列表
  skillIds?: string[];
}

/**
 * Agent详情响应类型（包含工具信息）
 * 注意：enabled_system_tools 在数据库层是 snake_case，API 层转换为 camelCase
 */
export interface AgentWithTools extends Omit<Agent, 'enabled_system_tools'> {
  tools: Array<{
    id: string;
    name: string;
    source: 'system' | 'mcp';
    serverName?: string;
  }>;
  // 启用的系统工具ID列表（已解析为数组）
  enabledSystemTools: string[];
  // 关联的 Skill 列表
  skills?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

/**
 * 公开Agent响应类型（包含创建者信息）
 */
export interface PublicAgentWithCreator extends AgentWithTools {
  creator?: {
    id: string;
    username: string | null;
  };
}

/**
 * 迁移SQL：为现有 user_skills 表添加 file_count 字段
 * 用于存储 Skill 目录中的文件数量
 */
export const MIGRATION_ADD_SKILL_FILE_COUNT = `
ALTER TABLE user_skills ADD COLUMN file_count INTEGER DEFAULT 1;
`;

/**
 * user_skills表 - 存储用户 Skill 元数据
 * storage_path: Supabase Storage 文件路径
 * file_hash: 文件 SHA256，用于版本检测
 * file_size: 文件大小（字节）
 */
export const CREATE_USER_SKILLS_TABLE = `
CREATE TABLE IF NOT EXISTS user_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,           -- 完整元数据 JSON（含 frontmatter）
  storage_path TEXT,       -- Supabase Storage 文件路径
  file_hash TEXT,          -- 文件 SHA256，用于版本检测
  file_size INTEGER,       -- 文件大小（字节）
  file_count INTEGER DEFAULT 1, -- 文件数量（目录中的文件总数）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

/**
 * agent_skills表 - Agent 与 Skill 多对多关联
 */
export const CREATE_AGENT_SKILLS_TABLE = `
CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES user_skills(id) ON DELETE CASCADE,
  UNIQUE(agent_id, skill_id)
);
`;

// ==================== API Key 管理相关表结构 ====================

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
 * Skill 相关索引
 */
export const CREATE_SKILLS_INDEXES = [
  // 按用户 ID 查询 Skill
  `CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);`,
  // 按用户和名称唯一索引（防止同名 Skill）
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_skills_name_user ON user_skills(user_id, name);`,
  // 按 Agent ID 查询关联的 Skill
  `CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id);`,
  // 按 Skill ID 查询关联的 Agent
  `CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id);`,
];

/**
 * API Key 相关索引
 */
export const CREATE_API_KEYS_INDEXES = [
  // 按用户 ID 查询 API Key
  `CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);`,
  // 按 Key 哈希快速查找（鉴权时使用）
  `CREATE INDEX IF NOT EXISTS idx_user_api_keys_key_hash ON user_api_keys(key_hash);`,
];

/**
 * UserSkill 类型定义
 * 用户上传的 Skill 元数据
 */
export interface UserSkill {
  id: string;
  user_id: string;
  name: string;
  description: string;
  metadata: string | null;     // 完整元数据 JSON
  storage_path: string | null; // Supabase Storage 路径
  file_hash: string | null;    // 文件 SHA256
  file_size: number | null;    // 文件大小（字节）
  file_count: number | null;   // 文件数量（目录中的文件总数）
  created_at: number;
  updated_at: number;
}

/**
 * AgentSkill 类型定义
 * Agent 与 Skill 的关联关系
 */
export interface AgentSkill {
  id: string;
  agent_id: string;
  skill_id: string;
  created_at: number;
}

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
 * 创建 Skill 的参数类型
 */
export interface CreateUserSkillParams {
  id: string;
  userId: string;
  name: string;
  description: string;
  metadata?: string;
  storagePath?: string;
  fileHash?: string;
  fileSize?: number;
  fileCount?: number;  // 文件数量
}

/**
 * 更新 Skill 的参数类型
 */
export interface UpdateUserSkillParams {
  name?: string;
  description?: string;
  metadata?: string;
  storagePath?: string;
  fileHash?: string;
  fileSize?: number;
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
 * Skill 校验结果类型
 */
export interface SkillValidationResult {
  valid: boolean;
  name?: string;
  description?: string;
  metadata?: string;
  error?: string;
}

/**
 * Skill 详情响应类型（含关联 Agent 数量）
 */
export interface UserSkillWithAgentCount extends UserSkill {
  agentCount: number;
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

// ==================== 消息撤回相关类型定义 ====================

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

// ==================== 会话压缩相关类型定义 ====================

/**
 * 压缩缓存类型定义
 * 存储在 conversation.compression_cache 字段中
 */
export interface CompressionCache {
  /** 压缩后的消息快照 */
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    parts: MessagePart[];
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

// ==================== 异步压缩相关类型定义 ====================

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
 * 注意：这是新的独立 checkpoint 类型，与旧的 CheckpointContent 不同
 * cache_content: 存储 compression_cache 的完整内容（JSON字符串），便于排查
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
 * cacheContent: 压缩缓存内容（JSON字符串），用于排查问题
 */
export interface CreateCheckpointRecordParams {
  conversationId: string;
  removedCount: number;
  originalMessageCount: number;
  // 压缩缓存内容（JSON字符串），用于排查
  cacheContent?: string;
}
