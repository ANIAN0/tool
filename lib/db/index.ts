import { getDb } from "./client";
import { INIT_SQL } from "./schema";

/**
 * 初始化数据库表结构
 * 创建conversations和messages表及其索引
 */
export async function initDatabase(): Promise<void> {
  const db = getDb();

  // 执行所有初始化SQL语句
  for (const sql of INIT_SQL) {
    await db.execute(sql);
  }
}

/**
 * 检查数据库是否已初始化
 * 通过检查conversations表是否存在来判断
 */
export async function isDatabaseInitialized(): Promise<boolean> {
  const db = getDb();

  try {
    // 查询conversations表是否存在
    const result = await db.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='conversations'
    `);

    return result.rows.length > 0;
  } catch {
    return false;
  }
}

// 导出数据库客户端
export { getDb, resetDb } from "./client";

// 导出schema类型和常量
export * from "./schema";

// 导出对话数据访问方法
export * from "./conversations";

// 导出消息数据访问方法
export * from "./messages";
