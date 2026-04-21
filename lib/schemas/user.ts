/**
 * 用户表结构定义
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
 * 创建用户的参数类型
 */
export interface CreateUserParams {
  id: string;
  username?: string;
  passwordHash?: string;
  isAnonymous?: boolean;
}