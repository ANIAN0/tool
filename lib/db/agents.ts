/**
 * Agent数据访问层
 * 提供Agent的CRUD操作和工具关联管理
 */

import { cache } from "react";
import { getDb } from "./client";
import {
  type Agent,
  type AgentTool,
  type CreateAgentParams,
  type UpdateAgentParams,
  type AgentWithTools,
  type PublicAgentWithCreator,
  type McpTool,
  type UserSkill,
} from "./schema";
import {
  getDefaultSystemTools,
  parseSystemTools,
  serializeSystemTools,
  isSystemToolId,
  type SystemToolId,
} from "@/lib/constants/system-tools";
import { getAgentsSkillsBatch, setAgentSkills } from "./skills";

// ==================== 辅助函数 ====================

/**
 * 将数据库行转换为Agent对象
 */
function mapRowToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: row.description as string | null,
    template_id: row.template_id as string,
    template_config: row.template_config as string | null,
    system_prompt: row.system_prompt as string | null,
    model_id: row.model_id as string | null,
    is_public: (row.is_public as number) === 1,
    enabled_system_tools: row.enabled_system_tools as string | null,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

/**
 * 将 Agent 数据库记录转换为 AgentWithTools 响应格式
 * @param agent - Agent 数据库记录
 * @param mcpTools - MCP工具列表
 * @returns AgentWithTools 格式的对象
 */
function buildAgentWithTools(
  agent: Agent,
  mcpTools: Array<{ id: string; name: string; serverName?: string }>
): AgentWithTools {
  // 解析系统工具
  const enabledSystemTools = parseSystemTools(agent.enabled_system_tools);

  // 构建工具列表：合并 MCP 工具和启用的系统工具
  // 系统工具需要标记 source 字段
  const systemToolsWithSource = enabledSystemTools.map((id) => ({
    id,
    name: id.replace('system:sandbox:', ''),
    source: 'system' as const,
  }));

  const mcpToolsWithSource = mcpTools.map((t) => ({
    ...t,
    source: 'mcp' as const,
  }));

  return {
    ...agent,
    enabledSystemTools,
    tools: [...systemToolsWithSource, ...mcpToolsWithSource],
  };
}

/**
 * 获取Agent关联的工具信息
 */
async function getAgentTools(agentId: string): Promise<
  Array<{
    id: string;
    name: string;
    serverName?: string;
  }>
> {
  const db = getDb();

  // 查询Agent关联的工具及其所属服务器名称
  const result = await db.execute({
    sql: `
      SELECT t.id, t.name, s.name as server_name
      FROM agent_tools at
      JOIN mcp_tools t ON at.tool_id = t.id
      LEFT JOIN user_mcp_servers s ON t.server_id = s.id
      WHERE at.agent_id = ?
      ORDER BY t.name
    `,
    args: [agentId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    serverName: row.server_name as string | undefined,
  }));
}

/**
 * 批量获取多个Agent的工具信息
 * 解决N+1查询问题
 */
async function getAgentsToolsBatch(agentIds: string[]): Promise<
  Map<string, Array<{ id: string; name: string; serverName?: string }>>
> {
  const db = getDb();

  // 如果没有Agent ID，返回空Map
  if (agentIds.length === 0) {
    return new Map();
  }

  // 一次性查询所有Agent的工具
  const placeholders = agentIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `
      SELECT at.agent_id, t.id, t.name, s.name as server_name
      FROM agent_tools at
      JOIN mcp_tools t ON at.tool_id = t.id
      LEFT JOIN user_mcp_servers s ON t.server_id = s.id
      WHERE at.agent_id IN (${placeholders})
      ORDER BY t.name
    `,
    args: agentIds,
  });

  // 按agent_id分组
  const toolsMap = new Map<string, Array<{ id: string; name: string; serverName?: string }>>();

  for (const row of result.rows) {
    const agentId = row.agent_id as string;
    if (!toolsMap.has(agentId)) {
      toolsMap.set(agentId, []);
    }
    toolsMap.get(agentId)!.push({
      id: row.id as string,
      name: row.name as string,
      serverName: row.server_name as string | undefined,
    });
  }

  // 确保所有Agent都有对应的条目（即使工具为空）
  for (const id of agentIds) {
    if (!toolsMap.has(id)) {
      toolsMap.set(id, []);
    }
  }

  return toolsMap;
}

/**
 * 插入Agent工具关联
 * 注意：只存储MCP工具的关联，系统工具（ID以'system:'开头）不需要存储
 */
async function insertAgentTools(
  agentId: string,
  toolIds: string[]
): Promise<void> {
  if (toolIds.length === 0) return;

  // 过滤掉系统工具（ID以'system:'开头），只保留MCP工具
  const mcpToolIds = toolIds.filter((id) => !id.startsWith("system:"));
  if (mcpToolIds.length === 0) return;

  const db = getDb();
  const now = Date.now();

  // 批量插入工具关联
  for (const toolId of mcpToolIds) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO agent_tools (id, agent_id, tool_id, created_at)
            VALUES (?, ?, ?, ?)`,
      args: [
        `${agentId}_${toolId}`, // 生成唯一ID
        agentId,
        toolId,
        now,
      ],
    });
  }
}

/**
 * 删除Agent的所有工具关联
 */
async function deleteAgentTools(agentId: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "DELETE FROM agent_tools WHERE agent_id = ?",
    args: [agentId],
  });
}

// ==================== 主要CRUD操作 ====================

/**
 * 创建新Agent
 * 同时创建工具关联
 */
export async function createAgent(params: CreateAgentParams): Promise<Agent> {
  const db = getDb();
  const now = Date.now();

  // 序列化template_config为JSON字符串
  const templateConfigJson = params.templateConfig
    ? JSON.stringify(params.templateConfig)
    : null;

  // 序列化enabledSystemTools为JSON字符串
  // 未提供时使用默认值（所有系统工具）
  const enabledSystemToolsJson = serializeSystemTools(
    params.enabledSystemTools || getDefaultSystemTools()
  );

  // 插入Agent记录
  await db.execute({
    sql: `INSERT INTO agents
          (id, user_id, name, description, template_id, template_config, system_prompt, model_id, is_public, enabled_system_tools, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.userId,
      params.name,
      params.description ?? null,
      params.templateId,
      templateConfigJson,
      params.systemPrompt ?? null,
      params.modelId ?? null,
      0, // 默认私有
      enabledSystemToolsJson,
      now,
      now,
    ],
  });

  // 如果有工具ID，创建关联
  if (params.toolIds && params.toolIds.length > 0) {
    await insertAgentTools(params.id, params.toolIds);
  }

  return {
    id: params.id,
    user_id: params.userId,
    name: params.name,
    description: params.description ?? null,
    template_id: params.templateId,
    template_config: templateConfigJson,
    system_prompt: params.systemPrompt ?? null,
    model_id: params.modelId ?? null,
    is_public: false,
    enabled_system_tools: enabledSystemToolsJson,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 根据ID获取Agent详情（包含工具信息）
 * 🚀 性能优化：使用 React.cache() 缓存查询结果，同一请求中避免重复查询
 */
export const getAgentById = cache(async (
  agentId: string,
  userId?: string
): Promise<AgentWithTools | null> => {
  const db = getDb();

  // 查询Agent
  const result = await db.execute({
    sql: "SELECT * FROM agents WHERE id = ?",
    args: [agentId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const agent = mapRowToAgent(result.rows[0]);

  // 如果提供了userId，验证访问权限（创建者或公开Agent）
  if (userId && agent.user_id !== userId && !agent.is_public) {
    return null;
  }

  // 获取关联的 MCP 工具
  const mcpTools = await getAgentTools(agentId);

  return buildAgentWithTools(agent, mcpTools);
});

/**
 * 获取用户的所有Agent
 * 使用批量查询优化，避免N+1问题
 * 🚀 性能优化：使用 React.cache() 缓存查询结果
 */
export const getAgentsByUserId = cache(async (userId: string): Promise<AgentWithTools[]> => {
  const db = getDb();

  // 查询用户的所有Agent
  const result = await db.execute({
    sql: `SELECT * FROM agents
          WHERE user_id = ?
          ORDER BY updated_at DESC`,
    args: [userId],
  });

  // 提取所有Agent ID
  const agentIds = result.rows.map((row) => row.id as string);

  // 批量获取所有Agent的工具信息（一次性查询）
  const toolsMap = await getAgentsToolsBatch(agentIds);

  // 批量获取所有Agent的Skill信息（一次性查询）
  // 使用静态导入的函数，避免运行时动态导入开销
  const skillsMap = await getAgentsSkillsBatch(agentIds);

  // 组装结果
  return result.rows.map((row) => {
    const agent = mapRowToAgent(row);
    const mcpTools = toolsMap.get(agent.id) || [];
    const skills = skillsMap.get(agent.id) || [];
    const agentWithTools = buildAgentWithTools(agent, mcpTools);
    // 添加 skills 字段
    return {
      ...agentWithTools,
      skills,
    };
  });
});

/**
 * 获取所有公开的Agent（排除指定用户的）
 * 用于发现/市场页面
 * 使用批量查询优化，避免N+1问题
 * 🚀 性能优化：使用 React.cache() 缓存查询结果
 */
export const getPublicAgents = cache(async (
  excludeUserId?: string
): Promise<PublicAgentWithCreator[]> => {
  const db = getDb();

  // 查询公开的Agent，可选择排除某用户
  let sql = `
    SELECT a.*, u.username as creator_username
    FROM agents a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.is_public = 1
  `;
  const args: string[] = [];

  if (excludeUserId) {
    sql += " AND a.user_id != ?";
    args.push(excludeUserId);
  }

  sql += " ORDER BY a.updated_at DESC";

  const result = await db.execute({ sql, args });

  // 提取所有Agent ID
  const agentIds = result.rows.map((row) => row.id as string);

  // 批量获取工具信息
  const toolsMap = await getAgentsToolsBatch(agentIds);

  // 批量获取Skill信息
  // 使用静态导入的函数，避免运行时动态导入开销
  const skillsMap = await getAgentsSkillsBatch(agentIds);

  // 组装结果
  return result.rows.map((row) => {
    const agent = mapRowToAgent(row);
    const mcpTools = toolsMap.get(agent.id) || [];
    const skills = skillsMap.get(agent.id) || [];
    const agentWithTools = buildAgentWithTools(agent, mcpTools);

    return {
      ...agentWithTools,
      skills,
      creator: {
        id: agent.user_id,
        username: row.creator_username as string | null,
      },
    };
  });
});

/**
 * 更新Agent
 * 同时更新工具关联
 */
export async function updateAgent(
  userId: string,
  agentId: string,
  params: UpdateAgentParams
): Promise<AgentWithTools | null> {
  const db = getDb();
  const now = Date.now();

  // 验证Agent存在且属于该用户
  const existing = await getAgentById(agentId, userId);
  if (!existing || existing.user_id !== userId) {
    return null;
  }

  // 构建更新字段
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (params.name !== undefined) {
    updates.push("name = ?");
    args.push(params.name);
  }
  if (params.description !== undefined) {
    updates.push("description = ?");
    args.push(params.description);
  }
  if (params.templateId !== undefined) {
    updates.push("template_id = ?");
    args.push(params.templateId);
  }
  if (params.templateConfig !== undefined) {
    updates.push("template_config = ?");
    args.push(params.templateConfig ? JSON.stringify(params.templateConfig) : null);
  }
  if (params.systemPrompt !== undefined) {
    updates.push("system_prompt = ?");
    args.push(params.systemPrompt);
  }
  if (params.modelId !== undefined) {
    updates.push("model_id = ?");
    args.push(params.modelId);
  }
  // 更新启用的系统工具
  if (params.enabledSystemTools !== undefined) {
    updates.push("enabled_system_tools = ?");
    args.push(serializeSystemTools(params.enabledSystemTools));
  }

  // 总是更新updated_at
  updates.push("updated_at = ?");
  args.push(now);

  if (updates.length > 0) {
    args.push(agentId);
    args.push(userId);

    await db.execute({
      sql: `UPDATE agents SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
      args,
    });
  }

  // 如果提供了toolIds，更新工具关联
  if (params.toolIds !== undefined) {
    // 先删除现有关联
    await deleteAgentTools(agentId);
    // 再插入新的关联
    await insertAgentTools(agentId, params.toolIds);
  }

  return getAgentById(agentId, userId);
}

/**
 * 删除Agent
 * 同时删除工具关联（外键会自动级联删除，但显式删除更清晰）
 */
export async function deleteAgent(
  userId: string,
  agentId: string
): Promise<boolean> {
  const db = getDb();

  // 验证Agent存在且属于该用户
  const existing = await getAgentById(agentId, userId);
  if (!existing || existing.user_id !== userId) {
    return false;
  }

  // 删除工具关联
  await deleteAgentTools(agentId);

  // 删除Agent
  const result = await db.execute({
    sql: "DELETE FROM agents WHERE id = ? AND user_id = ?",
    args: [agentId, userId],
  });

  return result.rowsAffected > 0;
}

/**
 * 设置Agent公开/私有状态
 */
export async function setAgentPublic(
  userId: string,
  agentId: string,
  isPublic: boolean
): Promise<Agent | null> {
  const db = getDb();
  const now = Date.now();

  // 验证Agent存在且属于该用户
  const existing = await getAgentById(agentId, userId);
  if (!existing || existing.user_id !== userId) {
    return null;
  }

  // 更新公开状态
  await db.execute({
    sql: "UPDATE agents SET is_public = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    args: [isPublic ? 1 : 0, now, agentId, userId],
  });

  // 返回更新后的Agent
  const result = await db.execute({
    sql: "SELECT * FROM agents WHERE id = ?",
    args: [agentId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToAgent(result.rows[0]);
}

/**
 * 检查用户是否为Agent创建者
 */
export async function isAgentCreator(
  userId: string,
  agentId: string
): Promise<boolean> {
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT user_id FROM agents WHERE id = ?",
    args: [agentId],
  });

  if (result.rows.length === 0) {
    return false;
  }

  return result.rows[0].user_id === userId;
}

/**
 * 获取Agent关联的MCP工具详情
 * 用于运行时获取完整的工具信息
 */
export async function getAgentMcpTools(agentId: string): Promise<McpTool[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT t.*
      FROM agent_tools at
      JOIN mcp_tools t ON at.tool_id = t.id
      WHERE at.agent_id = ? AND t.is_available = 1
      ORDER BY t.name
    `,
    args: [agentId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    server_id: row.server_id as string,
    name: row.name as string,
    description: row.description as string | null,
    input_schema: row.input_schema as string | null,
    is_available: (row.is_available as number) === 1,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

/**
 * Agent MCP 运行时配置
 * 用于运行时按 server 分组建连并筛选白名单工具
 */
export interface AgentMcpRuntimeToolConfig {
  // MCP 服务ID（对应 user_mcp_servers.id）
  serverId: string;
  // MCP 服务名称（用于日志和诊断）
  serverName: string;
  // MCP 服务URL（用于 createMCPClient）
  serverUrl: string;
  // MCP 服务自定义请求头（由数据库JSON反序列化）
  serverHeaders: Record<string, string>;
  // MCP 服务启用状态（false 时运行时应跳过）
  serverEnabled: boolean;
  // Agent 勾选的 MCP 工具名（远端工具白名单）
  toolName: string;
}

/**
 * 获取 Agent MCP 运行时工具配置
 * 数据来源：agent_tools + mcp_tools + user_mcp_servers
 */
export async function getAgentMcpRuntimeToolConfigs(
  agentId: string,
  agentOwnerUserId: string
): Promise<AgentMcpRuntimeToolConfig[]> {
  // 获取数据库连接
  const db = getDb();
  // 查询 Agent 绑定的 MCP 工具与所属服务配置
  const result = await db.execute({
    sql: `
      SELECT
        s.id AS server_id,
        s.name AS server_name,
        s.url AS server_url,
        s.headers AS server_headers,
        s.is_enabled AS server_enabled,
        t.name AS tool_name
      FROM agent_tools at
      JOIN mcp_tools t ON at.tool_id = t.id
      JOIN user_mcp_servers s ON t.server_id = s.id
      WHERE at.agent_id = ?
        AND s.user_id = ?
      ORDER BY s.id, t.name
    `,
    args: [agentId, agentOwnerUserId],
  });

  // 映射为运行时配置结构，供 mcp-runtime 使用
  return result.rows.map((row) => {
    // 解析服务headers，数据库中为空串时回退为空对象
    const headersText = row.server_headers ? String(row.server_headers) : "";
    let parsedHeaders: Record<string, string> = {};
    try {
      // 尝试解析JSON headers，失败时安全回退为空对象
      parsedHeaders = headersText ? (JSON.parse(headersText) as Record<string, string>) : {};
    } catch {
      // headers 格式异常时不抛错，运行时按无headers继续
      parsedHeaders = {};
    }

    return {
      // 返回服务ID
      serverId: String(row.server_id),
      // 返回服务名称，空值时给默认名用于日志可读性
      serverName: row.server_name ? String(row.server_name) : "unnamed-mcp-server",
      // 返回服务URL
      serverUrl: String(row.server_url),
      // 返回解析后的headers
      serverHeaders: parsedHeaders,
      // 返回启用状态
      serverEnabled: Number(row.server_enabled) === 1,
      // 返回工具名称
      toolName: String(row.tool_name),
    };
  });
}

// ==================== Agent Skill 关联操作 ====================

/**
 * 获取 Agent 关联的 Skill 简要信息
 * 用于 Agent 详情响应
 * 包含 fileHash 字段用于 Skill 运行时加载器检测版本变化
 */
export async function getAgentSkillsInfo(agentId: string): Promise<
  Array<{ id: string; name: string; description: string; storagePath: string | null; fileHash: string | null }>
> {
  const db = getDb();

  // 查询 Skill 基本信息，包含 file_hash 用于版本检测
  const result = await db.execute({
    sql: `SELECT s.id, s.name, s.description, s.storage_path, s.file_hash
          FROM user_skills s
          JOIN agent_skills AS ags ON s.id = ags.skill_id
          WHERE ags.agent_id = ?
          ORDER BY s.name`,
    args: [agentId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    storagePath: row.storage_path as string | null,
    // fileHash 用于 Skill 运行时加载器检测 Skill 文件版本变化
    fileHash: row.file_hash as string | null,
  }));
}

/**
 * 创建 Agent 时处理 Skill 关联
 * 如果有 Skill，强制包含 bash、readFile、writeFile 系统工具
 */
export async function createAgentWithSkills(
  params: CreateAgentParams,
  skillIds?: string[]
): Promise<Agent> {
  // 如果配置了 Skill，强制包含必要的系统工具
  let enabledSystemTools = params.enabledSystemTools || getDefaultSystemTools();

  if (skillIds && skillIds.length > 0) {
    const requiredTools: SystemToolId[] = [
      'system:sandbox:bash',
      'system:sandbox:readFile',
      'system:sandbox:writeFile',
    ];
    // 合并并去重
    enabledSystemTools = [...new Set([...enabledSystemTools, ...requiredTools])];
  }

  // 创建 Agent（带更新后的系统工具列表）
  const agent = await createAgent({
    ...params,
    enabledSystemTools,
  });

  // 创建 Skill 关联
  if (skillIds && skillIds.length > 0) {
    // 使用静态导入的函数，避免运行时动态导入开销
    await setAgentSkills(agent.id, skillIds);
  }

  return agent;
}

/**
 * 更新 Agent 时处理 Skill 关联
 */
export async function updateAgentWithSkills(
  userId: string,
  agentId: string,
  params: UpdateAgentParams,
  skillIds?: string[]
): Promise<AgentWithTools | null> {
  // 如果配置了 Skill，强制包含必要的系统工具
  let enabledSystemTools = params.enabledSystemTools;

  if (skillIds && skillIds.length > 0) {
    const requiredTools: SystemToolId[] = [
      'system:sandbox:bash',
      'system:sandbox:readFile',
      'system:sandbox:writeFile',
    ];
    // 获取当前启用的系统工具
    const currentTools = params.enabledSystemTools || [];
    // 合并并去重
    enabledSystemTools = [...new Set([...currentTools, ...requiredTools])];
  }

  // 更新 Agent
  const agent = await updateAgent(userId, agentId, {
    ...params,
    enabledSystemTools,
  });

  if (!agent) {
    return null;
  }

  // 更新 Skill 关联
  if (skillIds !== undefined) {
    // 使用静态导入的函数，避免运行时动态导入开销
    await setAgentSkills(agentId, skillIds);
  }

  return agent;
}

// ==================== 工具名称唯一性校验 ====================

/**
 * 校验工具名称唯一性
 * 用于Agent创建/更新时检查MCP工具名称是否重复
 *
 * @param toolIds - MCP工具ID列表
 * @returns 校验结果，包含重复的工具名称（如果有）
 */
export async function validateToolNamesUniqueness(
  toolIds: string[]
): Promise<{ valid: boolean; duplicates: string[] }> {
  if (toolIds.length === 0) {
    return { valid: true, duplicates: [] };
  }

  const db = getDb();

  // 查询所有工具的名称
  const placeholders = toolIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT id, name FROM mcp_tools WHERE id IN (${placeholders})`,
    args: toolIds,
  });

  // 提取名称列表
  const toolNames = result.rows.map((row) => row.name as string);

  // 查找重复名称
  const nameCount = new Map<string, number>();
  for (const name of toolNames) {
    nameCount.set(name, (nameCount.get(name) || 0) + 1);
  }

  const duplicates = Array.from(nameCount.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  return {
    valid: duplicates.length === 0,
    duplicates,
  };
}