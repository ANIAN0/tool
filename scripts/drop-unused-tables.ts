/**
 * 删除无用表脚本
 * 删除小说创作相关表和Agent配置相关表
 *
 * 执行方式：npx tsx scripts/drop-unused-tables.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(__dirname, "../.env") });

import { getDb } from "../lib/db/client";

/**
 * 要删除的表列表
 */
const TABLES_TO_DROP = {
  // 小说创作相关表（9个）
  novelTables: [
    "characters",
    "world_rules",
    "items",
    "locations",
    "outlines",
    "plot_lines",
    "chapters",
    "consistency_logs",
    "novel_tasks",
  ],
  // Agent配置相关表（2个）
  agentTables: ["agent_configs", "ai_chat_histories"],
};

/**
 * 检查表是否存在
 */
async function tableExists(tableName: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    args: [tableName],
  });
  return result.rows.length > 0;
}

/**
 * 获取表的行数
 */
async function getTableRowCount(tableName: string): Promise<number> {
  const db = getDb();
  try {
    const result = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    return (result.rows[0]?.count as number) || 0;
  } catch {
    return 0;
  }
}

/**
 * 删除表
 */
async function dropTable(tableName: string): Promise<boolean> {
  const db = getDb();
  try {
    await db.execute(`DROP TABLE IF EXISTS ${tableName}`);
    return true;
  } catch (error) {
    console.error(`  ❌ 删除失败: ${error}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 开始删除无用表 ===\n");

  const allTables = [...TABLES_TO_DROP.novelTables, ...TABLES_TO_DROP.agentTables];

  console.log(`准备删除 ${allTables.length} 个表：`);
  console.log(`\n【小说创作相关表】(${TABLES_TO_DROP.novelTables.length}个)`);
  TABLES_TO_DROP.novelTables.forEach((t) => console.log(`  - ${t}`));
  console.log(`\n【Agent配置相关表】(${TABLES_TO_DROP.agentTables.length}个)`);
  TABLES_TO_DROP.agentTables.forEach((t) => console.log(`  - ${t}`));

  console.log("\n----------------------------------------\n");

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // 处理小说创作相关表
  console.log("📚 处理小说创作相关表...\n");
  for (const tableName of TABLES_TO_DROP.novelTables) {
    process.stdout.write(`  ${tableName} ... `);

    const exists = await tableExists(tableName);
    if (!exists) {
      console.log("⏭️ 不存在，跳过");
      skipCount++;
      continue;
    }

    const rowCount = await getTableRowCount(tableName);
    if (rowCount > 0) {
      console.log(`⚠️ 存在 ${rowCount} 条数据，跳过删除`);
      skipCount++;
      continue;
    }

    const success = await dropTable(tableName);
    if (success) {
      console.log("✅ 已删除");
      successCount++;
    } else {
      failCount++;
    }
  }

  // 处理Agent配置相关表
  console.log("\n🤖 处理Agent配置相关表...\n");
  for (const tableName of TABLES_TO_DROP.agentTables) {
    process.stdout.write(`  ${tableName} ... `);

    const exists = await tableExists(tableName);
    if (!exists) {
      console.log("⏭️ 不存在，跳过");
      skipCount++;
      continue;
    }

    const rowCount = await getTableRowCount(tableName);
    if (rowCount > 0) {
      console.log(`⚠️ 存在 ${rowCount} 条数据，跳过删除`);
      skipCount++;
      continue;
    }

    const success = await dropTable(tableName);
    if (success) {
      console.log("✅ 已删除");
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log("\n----------------------------------------");
  console.log("\n=== 删除完成 ===");
  console.log(`✅ 成功删除: ${successCount} 个表`);
  console.log(`⏭️ 跳过: ${skipCount} 个表`);
  console.log(`❌ 失败: ${failCount} 个表`);

  // 显示剩余表
  console.log("\n=== 当前数据库表列表 ===");
  const db = getDb();
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  result.rows.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.name}`);
  });

  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ 执行失败:", error);
  process.exit(1);
});
