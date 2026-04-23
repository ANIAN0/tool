/**
 * POC — 启动 workflow 并返回流式响应
 *
 * 职责：
 * - 调用 start() 启动 pocWorkflow
 * - 将 run.readable 作为 UIMessageStream 返回给客户端
 */

import { start } from "workflow/api";
import { createUIMessageStreamResponse } from "ai";
import { pocWorkflow } from "@/app/workflows/workflowchat-poc";

export const maxDuration = 60;

export async function POST() {
  try {
    // 启动 workflow 并获取 run 句柄
    const run = await start(pocWorkflow);

    // 将 workflow 的可读流包装为 SSE 格式响应返回给前端
    return createUIMessageStreamResponse({
      stream: run.readable,
      headers: {
        "x-workflow-run-id": run.runId,
      },
    });
  } catch (error) {
    console.error("[workflowchat-poc] 启动失败:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}