/**
 * MCP 数据库操作函数
 * 提供 MCP 服务器数据的迁移等功能
 */

import { getDb } from "./client";

/**
 * 迁移 MCP 服务器数据到新用户
 * 将原用户的 MCP 服务器配置迁移到目标用户
 *
 * @param fromUserId - 原用户ID（匿名用户）
 * @param toUserId - 目标用户ID（注册用户）
 */
export async function migrateMcpData(
  fromUserId: string,
  toUserId: string
): Promise<void> {
  const db = getDb();

  // 将匿名用户的 MCP 服务器迁移到注册账户
  await db.execute({
    sql: `UPDATE user_mcp_servers SET user_id = ? WHERE user_id = ?`,
    args: [toUserId, fromUserId],
  });

  // MCP 工具通过 server_id 关联，无需单独迁移
}