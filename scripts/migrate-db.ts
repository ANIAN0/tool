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
 * 检查表是否存在
 */
async function tableExists(tableName: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [tableName],
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
 * 执行迁移：为 user_models 表添加 context_limit 字段
 */
async function migrateAddContextLimit(): Promise<void> {
  console.log("检查 user_models.context_limit 字段是否存在...");

  // 检查字段是否已存在
  if (await columnExists("user_models", "context_limit")) {
    console.log("✅ context_limit 字段已存在，无需迁移");
    return;
  }

  console.log("开始为 user_models 表添加 context_limit 字段...");
  const db = getDb();

  // 执行 ALTER TABLE - 添加 context_limit 字段，默认值 32000
  await db.execute(
    "ALTER TABLE user_models ADD COLUMN context_limit INTEGER DEFAULT 32000"
  );

  console.log("✅ context_limit 字段添加成功");
}

/**
 * 执行迁移：创建 compression_tasks 表
 */
async function migrateAddCompressionTasks(): Promise<void> {
  console.log("检查 compression_tasks 表是否存在...");

  // 检查表是否已存在
  if (await tableExists("compression_tasks")) {
    console.log("✅ compression_tasks 表已存在，无需迁移");
    return;
  }

  console.log("开始创建 compression_tasks 表...");
  const db = getDb();

  // 创建表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS compression_tasks (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      status INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `);

  // 创建唯一索引（每个会话只能有1个 pending 任务）
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_compression_tasks_pending_unique
    ON compression_tasks(conversation_id, status)
    WHERE status = 0
  `);

  console.log("✅ compression_tasks 表创建成功");
}

/**
 * 执行迁移：创建 checkpoints 表
 */
async function migrateAddCheckpoints(): Promise<void> {
  console.log("检查 checkpoints 表是否存在...");

  // 检查表是否已存在
  if (await tableExists("checkpoints")) {
    console.log("✅ checkpoints 表已存在，无需迁移");
    return;
  }

  console.log("开始创建 checkpoints 表...");
  const db = getDb();

  // 创建表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      removed_count INTEGER NOT NULL,
      original_message_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `);

  // 创建索引
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_checkpoints_conversation
    ON checkpoints(conversation_id, created_at DESC)
  `);

  console.log("✅ checkpoints 表创建成功");
}

/**
 * 执行迁移：将现有 messages 表中的 checkpoint 消息迁移到 checkpoints 表
 */
async function migrateCheckpointMessages(): Promise<void> {
  console.log("检查是否有需要迁移的 checkpoint 消息...");

  const db = getDb();

  // 检查 messages 表是否有 type 字段
  const typeColumnExists = await columnExists("messages", "type");
  if (!typeColumnExists) {
    console.log("✅ messages 表没有 type 字段，无需迁移");
    return;
  }

  // 查询所有 checkpoint 类型的消息
  const result = await db.execute({
    sql: "SELECT * FROM messages WHERE type = 'checkpoint'",
    args: [],
  });

  if (result.rows.length === 0) {
    console.log("✅ 没有需要迁移的 checkpoint 消息");
    return;
  }

  console.log(`开始迁移 ${result.rows.length} 条 checkpoint 消息...`);

  // 逐条迁移（使用事务保护）
  let successCount = 0;
  for (const row of result.rows) {
    try {
      // 解析 content JSON，失败则跳过此条记录
      let content;
      try {
        content = JSON.parse(row.content as string);
      } catch (parseError) {
        console.error(`解析 checkpoint ${row.id} 的 content JSON 失败:`, parseError);
        continue; // 跳过此条，继续迁移其他记录
      }

      // 使用事务保护整个迁移操作
      await db.execute("BEGIN TRANSACTION");

      try {
        // 插入到 checkpoints 表
        await db.execute({
          sql: `INSERT INTO checkpoints (id, conversation_id, removed_count, original_message_count, created_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [
            row.id,
            row.conversation_id,
            content.removedCount || 0,
            content.originalMessageCount || 0,
            row.created_at,
          ],
        });

        // 删除 messages 表中的记录
        await db.execute({
          sql: "DELETE FROM messages WHERE id = ?",
          args: [row.id],
        });

        // 提交事务
        await db.execute("COMMIT");
        successCount++;
      } catch (txError) {
        // 事务失败，执行回滚
        await db.execute("ROLLBACK");
        throw txError;
      }
    } catch (error) {
      console.error(`迁移 checkpoint ${row.id} 失败:`, error);
      // 事务已回滚，无需手动清理
    }
  }

  console.log(`✅ checkpoint 消息迁移完成，成功 ${successCount}/${result.rows.length} 条`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=== 数据库迁移开始 ===\n");

  try {
    await migrateAddAgentId();
    await migrateAddContextLimit();
    await migrateAddCompressionTasks();  // 新增：创建 compression_tasks 表
    await migrateAddCheckpoints();        // 新增：创建 checkpoints 表
    await migrateCheckpointMessages();    // 新增：迁移现有 checkpoint 数据
    console.log("\n=== 数据库迁移完成 ===");
  } catch (error) {
    console.error("\n❌ 迁移失败:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
