/**
 * POC — 验证 ToolLoopAgent 在 step 内流式输出
 *
 * 目标：
 * 1. ToolLoopAgent 在 "use step" 内可正常 stream 输出
 * 2. getWritable() 可成功写入 UIMessageStream chunk
 * 3. writer acquire/release 循环正常（独占锁机制）
 */

import { getWritable } from "workflow";
import { ToolLoopAgent, stepCountIs } from "ai";
import type { UIMessageChunk } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * 在 step 内执行 Agent 推理，将流式输出写入 workflow stream
 */
async function runPocAgentStep() {
  "use step";

  // 创建模型 provider（使用 OpenRouter 作为 POC 测试）
  const provider = createOpenAICompatible({
    name: "poc-provider",
    baseURL: process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

  // 创建 ToolLoopAgent 实例（首版空工具集）
  const agent = new ToolLoopAgent({
    model: provider.chatModel(process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free"),
    instructions: "你是一个POC测试助手。请简短回复。",
    tools: {},
    stopWhen: stepCountIs(10),
  });

  // 调用 Agent 流式推理
  const result = await agent.stream({
    messages: [{ role: "user", content: "你好，POC测试" }],
  });

  // 获取 workflow 可写流
  const writable = getWritable<UIMessageChunk>();

  // 遍历流式输出，逐个 chunk 写入 writable（acquire/release 循环）
  for await (const part of result.toUIMessageStream()) {
    const writer = writable.getWriter();
    try {
      await writer.write(part);
    } finally {
      writer.releaseLock();
    }
  }

  // 关闭与写入同一引用的流，通知消费者流已完成
  await writable.close();

  // 返回完成原因
  return { finishReason: await result.finishReason };
}

/**
 * POC Workflow 入口
 * 在 workflow 上下文中调度 step 执行
 */
export async function pocWorkflow() {
  "use workflow";

  const result = await runPocAgentStep();
  return result;
}