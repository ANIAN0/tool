/**
 * Skill 数据访问层
 * 提供 Skill 的 CRUD 操作和 Agent 关联管理
 */

import { getDb } from "./client";
import {
  type UserSkill,
  type AgentSkill,
  type CreateUserSkillParams,
  type UpdateUserSkillParams,
  type UserSkillWithAgentCount,
} from "./schema";

// ==================== 常量定义 ====================

// IN 子查询批量大小限制，防止大量 ID 查询导致性能问题
const MAX_BATCH_SIZE = 100;

// ==================== 辅助函数 ====================

/**
 * 将数据库行转换为 UserSkill 对象
 */
function mapRowToUserSkill(row: Record<string, unknown>): UserSkill {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: row.description as string,
    metadata: row.metadata as string | null,
    storage_path: row.storage_path as string | null,
    file_hash: row.file_hash as string | null,
    file_size: row.file_size as number | null,
    file_count: row.file_count as number | null,  // 文件数量
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

/**
 * 获取 Skill 关联的 Agent 数量
 */
async function getSkillAgentCount(skillId: string): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT COUNT(*) as count FROM agent_skills WHERE skill_id = ?",
    args: [skillId],
  });
  return (result.rows[0]?.count as number) || 0;
}

/**
 * 批量获取多个 Skill 的 Agent 关联数量
 * 支持分批处理，避免 IN 子句过大导致性能问题
 */
async function getSkillsAgentCountBatch(skillIds: string[]): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();

  if (!skillIds || skillIds.length === 0) {
    return countMap;
  }

  // 如果超过批量限制，分批处理
  if (skillIds.length > MAX_BATCH_SIZE) {
    for (let i = 0; i < skillIds.length; i += MAX_BATCH_SIZE) {
      const batch = skillIds.slice(i, i + MAX_BATCH_SIZE);
      const batchResult = await getSkillsAgentCountBatch(batch);
      // 合并结果
      batchResult.forEach((count, skillId) => {
        countMap.set(skillId, count);
      });
    }
    return countMap;
  }

  // 单批次查询逻辑
  const db = getDb();
  const placeholders = skillIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT skill_id, COUNT(*) as count FROM agent_skills WHERE skill_id IN (${placeholders}) GROUP BY skill_id`,
    args: skillIds,
  });

  for (const row of result.rows) {
    countMap.set(row.skill_id as string, (row.count as number) || 0);
  }

  // 确保所有 Skill 都有对应的条目
  for (const id of skillIds) {
    if (!countMap.has(id)) {
      countMap.set(id, 0);
    }
  }

  return countMap;
}

// ==================== CRUD 操作 ====================

/**
 * 创建新 Skill
 */
export async function createUserSkill(params: CreateUserSkillParams): Promise<UserSkill> {
  const db = getDb();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO user_skills
          (id, user_id, name, description, metadata, storage_path, file_hash, file_size, file_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.userId,
      params.name,
      params.description,
      params.metadata ?? null,
      params.storagePath ?? null,
      params.fileHash ?? null,
      params.fileSize ?? null,
      params.fileCount ?? 1,  // 默认文件数量为 1
      now,
      now,
    ],
  });

  return {
    id: params.id,
    user_id: params.userId,
    name: params.name,
    description: params.description,
    metadata: params.metadata ?? null,
    storage_path: params.storagePath ?? null,
    file_hash: params.fileHash ?? null,
    file_size: params.fileSize ?? null,
    file_count: params.fileCount ?? 1,  // 默认文件数量为 1
    created_at: now,
    updated_at: now,
  };
}

/**
 * 根据 ID 获取 Skill 详情
 */
export async function getUserSkillById(skillId: string): Promise<UserSkill | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM user_skills WHERE id = ?",
    args: [skillId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToUserSkill(result.rows[0]);
}

/**
 * 获取用户的所有 Skill（含关联 Agent 数量）
 */
export async function getUserSkillsByUserId(userId: string): Promise<UserSkillWithAgentCount[]> {
  const db = getDb();

  // 查询用户的所有 Skill
  const result = await db.execute({
    sql: `SELECT * FROM user_skills WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [userId],
  });

  // 提取所有 Skill ID
  const skillIds = result.rows.map((row) => row.id as string);

  // 批量获取 Agent 关联数量
  const countMap = await getSkillsAgentCountBatch(skillIds);

  // 组装结果
  return result.rows.map((row) => {
    const skill = mapRowToUserSkill(row);
    return {
      ...skill,
      agentCount: countMap.get(skill.id) || 0,
    };
  });
}

/**
 * 更新 Skill
 */
export async function updateUserSkill(
  userId: string,
  skillId: string,
  params: UpdateUserSkillParams
): Promise<UserSkill | null> {
  const db = getDb();
  const now = Date.now();

  // 验证 Skill 存在且属于该用户
  const existing = await getUserSkillById(skillId);
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
  if (params.metadata !== undefined) {
    updates.push("metadata = ?");
    args.push(params.metadata);
  }
  if (params.storagePath !== undefined) {
    updates.push("storage_path = ?");
    args.push(params.storagePath);
  }
  if (params.fileHash !== undefined) {
    updates.push("file_hash = ?");
    args.push(params.fileHash);
  }
  if (params.fileSize !== undefined) {
    updates.push("file_size = ?");
    args.push(params.fileSize);
  }

  // 总是更新 updated_at
  updates.push("updated_at = ?");
  args.push(now);

  if (updates.length > 0) {
    args.push(skillId);
    args.push(userId);

    await db.execute({
      sql: `UPDATE user_skills SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
      args,
    });
  }

  return getUserSkillById(skillId);
}

/**
 * 删除 Skill
 * 注意：调用前需检查 agentCount 是否为 0
 */
export async function deleteUserSkill(userId: string, skillId: string): Promise<boolean> {
  const db = getDb();

  // 验证 Skill 存在且属于该用户
  const existing = await getUserSkillById(skillId);
  if (!existing || existing.user_id !== userId) {
    return false;
  }

  // 删除 Agent 关联（通过外键会自动级联删除，但显式删除更清晰）
  await db.execute({
    sql: "DELETE FROM agent_skills WHERE skill_id = ?",
    args: [skillId],
  });

  // 删除 Skill 记录
  const result = await db.execute({
    sql: "DELETE FROM user_skills WHERE id = ? AND user_id = ?",
    args: [skillId, userId],
  });

  return result.rowsAffected > 0;
}

/**
 * 检查 Skill 名称是否已存在
 */
export async function isSkillNameExists(userId: string, name: string, excludeSkillId?: string): Promise<boolean> {
  const db = getDb();

  let sql = "SELECT id FROM user_skills WHERE user_id = ? AND name = ?";
  const args: string[] = [userId, name];

  if (excludeSkillId) {
    sql += " AND id != ?";
    args.push(excludeSkillId);
  }

  const result = await db.execute({ sql, args });
  return result.rows.length > 0;
}

// ==================== Agent-Skill 关联操作 ====================

/**
 * 获取 Agent 关联的 Skill 列表
 */
export async function getAgentSkills(agentId: string): Promise<UserSkill[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT s.* FROM user_skills s
          JOIN agent_skills ags ON s.id = ags.skill_id
          WHERE ags.agent_id = ?
          ORDER BY s.name`,
    args: [agentId],
  });

  return result.rows.map(mapRowToUserSkill);
}

/**
 * 批量获取多个 Agent 的 Skill 列表
 * 用于列表查询优化，避免 N+1 问题
 * 支持分批处理，避免 IN 子句过大导致性能问题
 * @param agentIds - Agent ID 列表
 * @returns Map<agentId, Skill简要信息[]>
 */
export async function getAgentsSkillsBatch(
  agentIds: string[]
): Promise<Map<string, Array<{ id: string; name: string; description: string }>>> {
  const skillsMap = new Map<string, Array<{ id: string; name: string; description: string }>>();

  if (!agentIds || agentIds.length === 0) {
    return skillsMap;
  }

  // 如果超过批量限制，分批处理
  if (agentIds.length > MAX_BATCH_SIZE) {
    for (let i = 0; i < agentIds.length; i += MAX_BATCH_SIZE) {
      const batch = agentIds.slice(i, i + MAX_BATCH_SIZE);
      const batchResult = await getAgentsSkillsBatch(batch);
      // 合并结果
      batchResult.forEach((skills, agentId) => {
        skillsMap.set(agentId, skills);
      });
    }
    return skillsMap;
  }

  // 单批次查询逻辑
  const db = getDb();
  const placeholders = agentIds.map(() => "?").join(",");

  // 一次性查询所有 agent 的 skills
  const result = await db.execute({
    sql: `SELECT ags.agent_id, s.id, s.name, s.description
          FROM agent_skills ags
          JOIN user_skills s ON ags.skill_id = s.id
          WHERE ags.agent_id IN (${placeholders})
          ORDER BY s.name`,
    args: agentIds,
  });

  // 按 agent_id 分组
  for (const row of result.rows) {
    const agentId = row.agent_id as string;
    if (!skillsMap.has(agentId)) {
      skillsMap.set(agentId, []);
    }
    skillsMap.get(agentId)!.push({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
    });
  }

  // 确保所有 Agent 都有对应的条目（即使 skills 为空）
  for (const id of agentIds) {
    if (!skillsMap.has(id)) {
      skillsMap.set(id, []);
    }
  }

  return skillsMap;
}

/**
 * 设置 Agent 关联的 Skill
 * 会先删除现有关联，再插入新关联
 */
export async function setAgentSkills(agentId: string, skillIds: string[]): Promise<void> {
  const db = getDb();
  const now = Date.now();

  // 删除现有关联
  await db.execute({
    sql: "DELETE FROM agent_skills WHERE agent_id = ?",
    args: [agentId],
  });

  // 插入新关联
  if (skillIds.length > 0) {
    for (const skillId of skillIds) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO agent_skills (id, agent_id, skill_id, created_at)
              VALUES (?, ?, ?, ?)`,
        args: [`${agentId}_${skillId}`, agentId, skillId, now],
      });
    }
  }
}

/**
 * 获取 Skill 关联的 Agent ID 列表
 */
export async function getSkillAgents(skillId: string): Promise<string[]> {
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT agent_id FROM agent_skills WHERE skill_id = ?",
    args: [skillId],
  });

  return result.rows.map((row) => row.agent_id as string);
}