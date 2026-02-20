import { createClient, type Client } from "@libsql/client";

/**
 * Turso数据库客户端实例
 * 通过环境变量配置连接：
 * - TURSO_DATABASE_URL: Turso数据库URL
 * - TURSO_AUTH_TOKEN: 认证令牌
 */
let db: Client | null = null;

/**
 * 获取Turso数据库客户端实例（单例模式）
 * 在服务器端环境中使用，避免重复创建连接
 */
export function getDb(): Client {
  // 如果已经创建过实例，直接返回
  if (db) {
    return db;
  }

  // 从环境变量获取数据库配置
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // 验证必要的环境变量
  if (!url) {
    throw new Error("缺少环境变量: TURSO_DATABASE_URL");
  }

  if (!authToken) {
    throw new Error("缺少环境变量: TURSO_AUTH_TOKEN");
  }

  // 创建数据库客户端
  db = createClient({
    url,
    authToken,
  });

  return db;
}

/**
 * 重置数据库连接（主要用于测试）
 */
export function resetDb(): void {
  db = null;
}
