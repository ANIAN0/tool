/**
 * MCP服务器和Skill表结构定义
 */

// ==================== MCP服务器表结构 ====================

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
  headers TEXT,  -- 存储 JSON 格式的 headers
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

// ==================== MCP类型定义 ====================

/**
 * MCP服务器类型定义
 */
export interface McpServer {
  id: string;
  user_id: string;
  name: string;
  url: string;
  headers: string | null;  // JSON 格式的 headers
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
  headers?: string;  // JSON 格式的 headers
}

/**
 * 更新MCP服务器的参数类型
 */
export interface UpdateMcpServerParams {
  name?: string;
  url?: string;
  isEnabled?: boolean;
  headers?: string;  // JSON 格式的 headers
}

// ==================== Skill表结构 ====================

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

// ==================== Skill类型定义 ====================

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