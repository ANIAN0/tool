/**
 * 检查会话的缓存和 checkpoint 数据
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const conversationId = process.argv[2] || "CQ3rRKskOdDvSlSzGubzK";

async function checkConversation() {
  console.log("=== 检查会话:", conversationId, "===\n");

  // 1. 检查会话是否存在
  const convResult = await db.execute({
    sql: "SELECT * FROM conversations WHERE id = ?",
    args: [conversationId],
  });

  if (convResult.rows.length === 0) {
    console.log("❌ 会话不存在");
    return;
  }

  const conv = convResult.rows[0];
  console.log("✅ 会话信息:");
  console.log("  - title:", conv.title);
  console.log("  - agent_id:", conv.agent_id);
  console.log("  - source:", conv.source);
  console.log("  - total_input_tokens:", conv.total_input_tokens);
  console.log("  - total_output_tokens:", conv.total_output_tokens);
  console.log("  - total_tokens:", conv.total_tokens);

  // 2. 检查 compression_cache
  console.log("\n📦 compression_cache:");
  if (conv.compression_cache) {
    try {
      const cache = JSON.parse(conv.compression_cache as string);
      console.log("  ✅ 有缓存");
      console.log("  - messageCount:", cache.messageCount);
      console.log("  - removedCount:", cache.removedCount);
      console.log("  - compressedAt:", new Date(cache.compressedAt).toISOString());
      console.log("  - messages 数量:", cache.messages?.length || 0);
    } catch (e) {
      console.log("  ❌ 缓存解析失败:", conv.compression_cache);
    }
  } else {
    console.log("  ❌ 无缓存");
  }

  // 3. 检查消息数量
  const msgCountResult = await db.execute({
    sql: "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?",
    args: [conversationId],
  });
  console.log("\n📝 messages 表消息数量:", msgCountResult.rows[0]?.count || 0);

  // 4. 检查 checkpoints 表
  const checkpointResult = await db.execute({
    sql: "SELECT * FROM checkpoints WHERE conversation_id = ? ORDER BY created_at DESC",
    args: [conversationId],
  });
  console.log("\n🔵 checkpoints 表:");
  if (checkpointResult.rows.length === 0) {
    console.log("  ❌ 无记录");
  } else {
    checkpointResult.rows.forEach((cp, i) => {
      console.log(`  Checkpoint ${i + 1}:`);
      console.log("    - id:", cp.id);
      console.log("    - removed_count:", cp.removed_count);
      console.log("    - original_message_count:", cp.original_message_count);
      console.log("    - created_at:", new Date(cp.created_at as number).toISOString());
    });
  }

  // 5. 检查压缩任务
  const taskResult = await db.execute({
    sql: "SELECT * FROM compression_tasks WHERE conversation_id = ?",
    args: [conversationId],
  });
  console.log("\n📋 compression_tasks 表:");
  if (taskResult.rows.length === 0) {
    console.log("  ❌ 无记录");
  } else {
    taskResult.rows.forEach((task, i) => {
      console.log(`  任务 ${i + 1}:`);
      console.log("    - status:", task.status === 0 ? "pending" : "completed");
      console.log("    - created_at:", new Date(task.created_at as number).toISOString());
    });
  }

  // 6. 检查 messages 表中是否有旧的 checkpoint 消息
  const oldCheckpointResult = await db.execute({
    sql: "SELECT * FROM messages WHERE conversation_id = ? AND type = 'checkpoint'",
    args: [conversationId],
  });
  console.log("\n⚠️ 旧 checkpoint 消息 (messages.type='checkpoint'):");
  if (oldCheckpointResult.rows.length === 0) {
    console.log("  ✅ 无旧 checkpoint 消息");
  } else {
    console.log("  发现", oldCheckpointResult.rows.length, "条旧 checkpoint 消息:");
    oldCheckpointResult.rows.forEach((msg) => {
      console.log("    - id:", msg.id);
      console.log("      content:", msg.content);
    });
  }

  // 7. 检查最近的几条消息
  const recentMessages = await db.execute({
    sql: "SELECT id, role, type, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 5",
    args: [conversationId],
  });
  console.log("\n📜 最近 5 条消息:");
  recentMessages.rows.forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] type=${msg.type || 'normal'}, id=${msg.id}`);
  });

  console.log("\n=== 检查完成 ===");
}

checkConversation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("检查失败:", err);
    process.exit(1);
  });