import { getDb } from "./client";
import type { User } from "@/lib/schemas";
import { cache } from 'react';

/**
 * 将数据库行转换为User类型
 */
function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string | null,
    password_hash: row.password_hash as string | null,
    is_anonymous: Boolean(row.is_anonymous),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

/**
 * 根据ID获取用户（带缓存）
 * 使用 React.cache() 缓存同一请求内的重复查询
 */
const getUserByIdCached = cache(async (id: string): Promise<User | null> => {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM users WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToUser(result.rows[0]);
});

/**
 * 根据用户名获取用户（带缓存）
 * 使用 React.cache() 缓存同一请求内的重复查询
 */
const getUserByUsernameCached = cache(async (username: string): Promise<User | null> => {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM users WHERE username = ?`,
    args: [username],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToUser(result.rows[0]);
});

/**
 * 根据ID获取用户
 * @param id - 用户ID
 * @returns 用户记录，不存在则返回null
 */
export async function getUserById(id: string): Promise<User | null> {
  return getUserByIdCached(id);
}

/**
 * 根据用户名获取用户
 * @param username - 用户名
 * @returns 用户记录，不存在则返回null
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  return getUserByUsernameCached(username);
}

/**
 * 创建注册用户
 * @param id - 用户ID
 * @param username - 用户名
 * @param passwordHash - 密码哈希
 * @returns 新创建的用户记录
 */
export async function createUser(
  id: string,
  username: string,
  passwordHash: string
): Promise<User> {
  const db = getDb();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO users (id, username, password_hash, is_anonymous, created_at, updated_at)
          VALUES (?, ?, ?, 0, ?, ?)`,
    args: [id, username, passwordHash, now, now],
  });

  return {
    id,
    username,
    password_hash: passwordHash,
    is_anonymous: false,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 更新用户密码
 * @param id - 用户ID
 * @param passwordHash - 新密码哈希
 * @returns 更新后的用户记录，不存在则返回null
 */
export async function updateUserPassword(
  id: string,
  passwordHash: string
): Promise<User | null> {
  const db = getDb();
  const now = Date.now();

  const result = await db.execute({
    sql: `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`,
    args: [passwordHash, now, id],
  });

  if (result.rowsAffected === 0) {
    return null;
  }

  return getUserById(id);
}

/**
 * 更新用户名
 * @param id - 用户ID
 * @param username - 新用户名
 * @returns 更新后的用户记录，不存在或用户名已使用则返回null
 */
export async function updateUsername(
  id: string,
  username: string
): Promise<User | null> {
  const db = getDb();
  const now = Date.now();

  // 检查用户名是否已被使用
  const existingUser = await getUserByUsername(username);
  if (existingUser && existingUser.id !== id) {
    throw new Error("用户名已被使用");
  }

  const result = await db.execute({
    sql: `UPDATE users SET username = ?, updated_at = ? WHERE id = ?`,
    args: [username, now, id],
  });

  if (result.rowsAffected === 0) {
    return null;
  }

  return getUserById(id);
}