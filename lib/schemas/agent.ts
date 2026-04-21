/**
 * Agent配置表结构定义
 */

// ==================== 表结构定义 ====================

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

// ==================== 类型定义 ====================

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