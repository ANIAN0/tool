/**
 * 用户模型数据访问层
 * 提供UserModel的CRUD操作
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getDb } from "./client";
import {
  type UserModel,
  type CreateUserModelParams,
  type UpdateUserModelParams,
} from "@/lib/schemas";

/**
 * 根据ID获取单个模型
 * 🚀 性能优化：使用 React.cache() 缓存查询结果
 */
export const getUserModelById = cache(async (
  userId: string,
  modelId: string
): Promise<UserModel | null> => {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM user_models WHERE id = ? AND user_id = ?",
    args: [modelId, userId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToUserModel(result.rows[0]);
});

/**
 * 获取用户的所有模型
 * 🚀 性能优化：使用 React.cache() 缓存查询结果
 */
export const getUserModels = cache(async (userId: string): Promise<UserModel[]> => {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM user_models
          WHERE user_id = ?
          ORDER BY is_default DESC, created_at DESC`,
    args: [userId],
  });

  return result.rows.map(rowToUserModel);
});

/**
 * 获取用户的默认模型
 * 🚀 性能优化：使用 unstable_cache() 实现跨请求缓存，减少数据库查询
 * 缓存时间：60秒，标签：user-models
 */
export const getDefaultUserModel = unstable_cache(
  async (userId: string): Promise<UserModel | null> => {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM user_models WHERE user_id = ? AND is_default = 1 LIMIT 1",
      args: [userId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return rowToUserModel(result.rows[0]);
  },
  ["default-user-model"],
  { revalidate: 60, tags: ["user-models"] }
);

/**
 * 创建新模型
 */
export async function createUserModel(
  params: CreateUserModelParams
): Promise<UserModel> {
  const db = getDb();
  const now = Date.now();

  // 如果是第一个模型或设置为默认，先取消其他默认
  if (params.isDefault) {
    await db.execute({
      sql: "UPDATE user_models SET is_default = 0 WHERE user_id = ?",
      args: [params.userId],
    });
  }

  // 获取 context_limit，默认 32000
  const contextLimit = params.contextLimit ?? 32000;

  await db.execute({
    sql: `INSERT INTO user_models
          (id, user_id, name, provider, model, api_key, base_url, is_default, context_limit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.userId,
      params.name,
      params.provider,
      params.model,
      params.apiKey,
      params.baseUrl ?? null,
      params.isDefault ? 1 : 0,
      contextLimit,
      now,
      now,
    ],
  });

  return {
    id: params.id,
    user_id: params.userId,
    name: params.name,
    provider: params.provider,
    model: params.model,
    api_key: params.apiKey,
    base_url: params.baseUrl ?? null,
    is_default: params.isDefault ?? false,
    context_limit: contextLimit,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 更新模型
 */
export async function updateUserModel(
  userId: string,
  modelId: string,
  params: UpdateUserModelParams
): Promise<UserModel | null> {
  const db = getDb();
  const now = Date.now();

  // 获取现有模型
  const existing = await getUserModelById(userId, modelId);
  if (!existing) {
    return null;
  }

  // 如果设置为默认，先取消其他默认
  if (params.isDefault) {
    await db.execute({
      sql: "UPDATE user_models SET is_default = 0 WHERE user_id = ?",
      args: [userId],
    });
  }

  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (params.name !== undefined) {
    updates.push("name = ?");
    args.push(params.name);
  }
  if (params.provider !== undefined) {
    updates.push("provider = ?");
    args.push(params.provider);
  }
  if (params.model !== undefined) {
    updates.push("model = ?");
    args.push(params.model);
  }
  if (params.apiKey !== undefined) {
    updates.push("api_key = ?");
    args.push(params.apiKey);
  }
  if (params.baseUrl !== undefined) {
    updates.push("base_url = ?");
    args.push(params.baseUrl);
  }
  if (params.isDefault !== undefined) {
    updates.push("is_default = ?");
    args.push(params.isDefault ? 1 : 0);
  }
  // 新增：context_limit 更新
  if (params.contextLimit !== undefined) {
    updates.push("context_limit = ?");
    args.push(params.contextLimit);
  }

  updates.push("updated_at = ?");
  args.push(now);
  args.push(modelId);
  args.push(userId);

  if (updates.length > 1) {
    await db.execute({
      sql: `UPDATE user_models SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
      args,
    });
  }

  return getUserModelById(userId, modelId);
}

/**
 * 删除模型
 */
export async function deleteUserModel(
  userId: string,
  modelId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "DELETE FROM user_models WHERE id = ? AND user_id = ?",
    args: [modelId, userId],
  });

  return result.rowsAffected > 0;
}

/**
 * 设置默认模型
 */
export async function setDefaultUserModel(
  userId: string,
  modelId: string
): Promise<UserModel | null> {
  const db = getDb();

  // 验证模型存在
  const model = await getUserModelById(userId, modelId);
  if (!model) {
    return null;
  }

  // 先取消所有默认
  await db.execute({
    sql: "UPDATE user_models SET is_default = 0, updated_at = ? WHERE user_id = ?",
    args: [Date.now(), userId],
  });

  // 设置新的默认
  await db.execute({
    sql: "UPDATE user_models SET is_default = 1, updated_at = ? WHERE id = ?",
    args: [Date.now(), modelId],
  });

  return getUserModelById(userId, modelId);
}

/**
 * 将数据库行转换为UserModel对象
 */
function rowToUserModel(row: Record<string, unknown>): UserModel {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    provider: row.provider as string,
    model: row.model as string,
    api_key: row.api_key as string,
    base_url: row.base_url as string | null,
    is_default: (row.is_default as number) === 1,
    context_limit: (row.context_limit as number) ?? 32000, // 新增，默认 32000
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}
