/**
 * 数据库迁移脚本
 * 用于为现有数据库添加新字段
 * 
 * 执行方式：npx tsx scripts/migrate-db.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(__dirname, "../.env") });

import { getDb } from "../lib/db/client";

/**
 * 检查字段是否存在
 */
async function columnExists(
  tableName: string,
  columnName: string
): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM pragma_table_info(?) WHERE name = ?",
    args: [tableName, columnName],
  });
  return result.rows.length > 0;
}

/**
 * 执行迁移：添加 agent_id 字段
 */
async function migrateAddAgentId(): Promise<void> {
  console.log("检查 agent_id 字段是否存在...");

  // 检查字段是否已存在
  if (await columnExists("conversations", "agent_id")) {
    console.log("✅ agent_id 字段已存在，无需迁移");
    return;
  }

  console.log("开始添加 agent_id 字段...");
  const db = getDb();

  // 执行 ALTER TABLE
  await db.execute(
    "ALTER TABLE conversations ADD COLUMN agent_id TEXT DEFAULT 'production'"
  );

  console.log("✅ agent_id 字段添加成功");
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 数据库迁移开始 ===\n");

  try {
    await migrateAddAgentId();
    console.log("\n=== 数据库迁移完成 ===");
  } catch (error) {
    console.error("\n❌ 迁移失败:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
