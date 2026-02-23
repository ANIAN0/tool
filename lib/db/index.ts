import { getDb } from "./client";
import { INIT_SQL, MIGRATION_ADD_AGENT_ID, MIGRATION_ADD_IS_PRIVATE, CREATE_USERS_TABLE } from "./schema";

/**
 * 初始化数据库表结构
 * 创建users、conversations和messages表及其索引
 */
export async function initDatabase(): Promise<void> {
  const db = getDb();

  // 先创建users表
  await db.execute(CREATE_USERS_TABLE);

  // 执行所有初始化SQL语句
  for (const sql of INIT_SQL) {
    await db.execute(sql);
  }
}

/**
 * 执行数据库迁移
 * 为现有数据库添加新字段
 */
export async function migrateDatabase(): Promise<void> {
  const db = getDb();

  // 迁移1：添加 agent_id 字段
  try {
    await db.execute(MIGRATION_ADD_AGENT_ID);
    console.log("数据库迁移成功：已添加 agent_id 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("agent_id 字段已存在，跳过迁移");
    } else {
      console.error("数据库迁移失败:", error);
    }
  }

  // 迁移2：添加 is_private 字段
  try {
    await db.execute(MIGRATION_ADD_IS_PRIVATE);
    console.log("数据库迁移成功：已添加 is_private 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("is_private 字段已存在，跳过迁移");
    } else {
      console.error("数据库迁移失败:", error);
    }
  }

  // 迁移3：确保users表存在
  try {
    await db.execute(CREATE_USERS_TABLE);
    console.log("users 表已创建或已存在");
  } catch (error) {
    console.error("创建 users 表失败:", error);
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

// 导出用户数据访问方法
export * from "./users";

// 导出对话数据访问方法
export * from "./conversations";

// 导出消息数据访问方法
export * from "./messages";
