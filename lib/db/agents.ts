/**
 * Agent数据访问层
 * 提供Agent的CRUD操作和工具关联管理
 */

import { getDb } from "./client";
import {
  type Agent,
  type AgentTool,
  type CreateAgentParams,
  type UpdateAgentParams,
  type AgentWithTools,
  type PublicAgentWithCreator,
  type McpTool,
} from "./schema";

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
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
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
 */
async function insertAgentTools(
  agentId: string,
  toolIds: string[]
): Promise<void> {
  if (toolIds.length === 0) return;

  const db = getDb();
  const now = Date.now();

  // 批量插入工具关联
  for (const toolId of toolIds) {
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

  // 插入Agent记录
  await db.execute({
    sql: `INSERT INTO agents
          (id, user_id, name, description, template_id, template_config, system_prompt, model_id, is_public, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    created_at: now,
    updated_at: now,
  };
}

/**
 * 根据ID获取Agent详情（包含工具信息）
 */
export async function getAgentById(
  agentId: string,
  userId?: string
): Promise<AgentWithTools | null> {
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

  // 获取关联的工具
  const tools = await getAgentTools(agentId);

  return {
    ...agent,
    tools,
  };
}

/**
 * 获取用户的所有Agent
 * 使用批量查询优化，避免N+1问题
 */
export async function getAgentsByUserId(userId: string): Promise<AgentWithTools[]> {
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

  // 组装结果
  return result.rows.map((row) => {
    const agent = mapRowToAgent(row);
    return {
      ...agent,
      tools: toolsMap.get(agent.id) || [],
    };
  });
}

/**
 * 获取所有公开的Agent（排除指定用户的）
 * 用于发现/市场页面
 * 使用批量查询优化，避免N+1问题
 */
export async function getPublicAgents(
  excludeUserId?: string
): Promise<PublicAgentWithCreator[]> {
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

  // 批量获取所有Agent的工具信息（一次性查询）
  const toolsMap = await getAgentsToolsBatch(agentIds);

  // 组装结果
  return result.rows.map((row) => {
    const agent = mapRowToAgent(row);
    return {
      ...agent,
      creator: {
        id: agent.user_id,
        username: row.creator_username as string | null,
      },
      tools: toolsMap.get(agent.id) || [],
    };
  });
}

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