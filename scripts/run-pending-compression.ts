/**
 * 手动执行 pending 压缩任务
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import {
  getPendingCompressionTask,
  executeCompressionTask,
  completeCompressionTask,
} from "../lib/db/compression";

const conversationId = process.argv[2] || "CQ3rRKskOdDvSlSzGubzK";

async function runPendingTask() {
  console.log("=== 手动执行压缩任务 ===\n");
  console.log("会话 ID:", conversationId);

  // 获取 pending 任务
  const task = await getPendingCompressionTask(conversationId);

  if (!task) {
    console.log("\n❌ 无 pending 压缩任务");
    return;
  }

  console.log("\n找到 pending 任务:");
  console.log("  - task id:", task.id);
  console.log("  - created_at:", new Date(task.created_at).toISOString());

  // 执行压缩
  console.log("\n开始执行压缩...");
  try {
    const { removedCount } = await executeCompressionTask(conversationId);
    console.log("✅ 压缩完成，移除消息数:", removedCount);

    // 标记完成
    await completeCompressionTask(task.id);
    console.log("✅ 任务已标记完成");
  } catch (error) {
    console.error("❌ 压缩执行失败:", error);
  }
}

runPendingTask()
  .then(() => {
    console.log("\n=== 完成 ===");
    process.exit(0);
  })
  .catch((err) => {
    console.error("执行失败:", err);
    process.exit(1);
  });