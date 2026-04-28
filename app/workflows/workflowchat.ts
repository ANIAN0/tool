/**
 * WorkflowChat 主回复 Workflow
 *
 * 编排流程：
 * 1. createModelStep — 使用 ModelService 创建语言模型
 * 2. claimActiveStream（双保障）— 幂等 claim active_stream_id
 * 3. runAgentStep — 执行 ToolLoopAgent 流式推理，写入 workflow stream
 * 4. finalizeRun — 同步更新 run 状态（step 函数，避免 sandbox 问题）
 * 5. triggerPostFinish — 触发 post-finish 后处理
 *
 * 重要：所有依赖 @libsql/client 的 DB 操作必须在 step 函数中执行，
 * 因为 workflow 函数运行在 VM sandbox 中，require 不可用。
 */

import { getWritable, getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { convertToModelMessages } from "ai";
import type { UIMessage, UIMessageChunk, LanguageModel, ToolSet } from "ai";

import { createWorkflowChatAgent } from "@/lib/workflowchat/agent";
import { createModel } from "@/lib/infra/model";
import { claimChatActiveStreamId, updateWfChatRun, getWfChatRun } from "@/lib/workflowchat/repository";
import { WORKFLOWCHAT_RUN_STATUS } from "@/lib/workflowchat/constants";
import type { WorkflowChatRunInput, PostFinishInput } from "@/lib/workflowchat/dto";
import type { StepTiming } from "@/lib/workflowchat/constants";

import { workflowchatPostFinishWorkflow } from "./workflowchat-post-finish";

// ==================== Step 函数 ====================

/**
 * Step 1: createModelStep — 使用 ModelService 创建语言模型
 *
 * 在 step 函数中调用 ModelService.createModel() 创建语言模型实例
 */
async function createModelStep(input: WorkflowChatRunInput) {
  "use step";

  const { conversationId, runId, userId, modelId } = input;

  try {
    const result = await createModel({
      modelId,
      userId: userId ?? "",
      wrapDevTools: process.env.NODE_ENV === "development",
    });

    return {
      model: result.model,
      modelName: result.modelName,
      contextLimit: result.contextLimit,
    };
  } catch (error) {
    throw new Error(
      `创建模型失败: ${modelId} - ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Step 1: claimActiveStream（双保障第一步）
 *
 * 幂等 claim active_stream_id：
 * - slot 为空或已被自己占有时成功
 * - slot 被他人占有时抛出错误，终止 workflow
 */
async function claimActiveStream(conversationId: string, workflowRunId: string) {
  "use step";

  const claimed = await claimChatActiveStreamId(conversationId, workflowRunId);
  if (!claimed) {
    throw new Error(
      `claimActiveStream 失败：会话 ${conversationId} 的 active_stream_id 已被其他 run 占用`,
    );
  }
}

/**
 * Step 2: runAgentStep — 执行 Agent 推理并流式写入
 *
 * 接收 Step 1 创建的模型实例，流式推理，将输出逐 chunk 写入 workflow stream。
 * 通过 onFinish 回调捕获 responseMessage 和 usage。
 */
async function runAgentStep(
  input: WorkflowChatRunInput,
  model: LanguageModel,
  maxSteps: number,
  customInstructions?: string,
  tools?: ToolSet
) {
  "use step";

  // 使用外部传入的模型实例、运行时参数和工具集合
  const agent = createWorkflowChatAgent({
    model,
    maxSteps,
    customInstructions,
    tools,
  });

  // UIMessage[] → ModelMessage[] 转换
  const uiMessagesWithoutId = input.messages.map(({ id, ...rest }) => rest);
  const modelMessages = await convertToModelMessages(uiMessagesWithoutId);

  // 调用 Agent 流式推理
  const result = await agent.stream({
    messages: modelMessages,
  });

  // 获取 workflow 可写流
  const writable = getWritable<UIMessageChunk>();

  // 用于收集 responseMessage（通过 onFinish 回调获取）
  let responseMessage: UIMessage | null = null;
  let chunkCount = 0;

  // 遍历流式输出，逐个 chunk 写入 writable（acquire/release 循环）
  for await (const part of result.toUIMessageStream({
    onFinish: async (event) => {
      responseMessage = event.responseMessage;
    },
  })) {
    chunkCount++;
    const writer = writable.getWriter();
    try {
      await writer.write(part);
    } finally {
      writer.releaseLock();
    }
  }

  // 关闭流，通知消费者流已完成
  await writable.close();

  const finishReason = await result.finishReason;
  const rawUsage = await result.usage;

  // 处理 usage：AI SDK v4 的 LanguageModelUsage 使用 inputTokens/outputTokens
  const usage = rawUsage ? {
    promptTokens: rawUsage.inputTokens ?? 0,
    completionTokens: rawUsage.outputTokens ?? 0,
    totalTokens: rawUsage.totalTokens ?? (rawUsage.inputTokens ?? 0) + (rawUsage.outputTokens ?? 0),
  } : null;

  // 返回完成信息
  return {
    responseMessage,
    finishReason,
    usage,
  };
}

/**
 * Step 3: finalizeRun — 同步更新 run 状态
 *
 * 在主 workflow 的 finally 中调用，确保 run 状态在 post-finish 之前更新。
 * 必须是 step 函数，因为 getWfChatRun/updateWfChatRun 依赖 @libsql/client，
 * 在 workflow sandbox 中 require 不可用。
 */
async function finalizeRun(params: {
  runId: string;
  finishReason: string;
  error: string | null;
}) {
  "use step";

  const isFailed = params.finishReason === "failed";
  const now = Date.now();

  try {
    const run = await getWfChatRun(params.runId);
    const totalDurationMs = run?.started_at != null ? now - run.started_at : null;

    await updateWfChatRun(params.runId, {
      status: isFailed ? WORKFLOWCHAT_RUN_STATUS.FAILED : WORKFLOWCHAT_RUN_STATUS.COMPLETED,
      finishedAt: now,
      totalDurationMs,
      errorJson: isFailed && params.error ? JSON.stringify({ message: params.error }) : null,
    });
  } catch (e) {
    // DB 更新失败不影响后续流程，post-finish 会做防御性更新
    console.error("[finalizeRun] DB更新失败:", e);
  }
}

/**
 * Step 4: triggerPostFinish — 触发后处理 workflow
 * start() 必须在 step 函数中调用，不能在 workflow 主体中直接调用
 */
async function triggerPostFinish(input: PostFinishInput) {
  "use step";
  await start(workflowchatPostFinishWorkflow, [input]);
}

// ==================== 主 Workflow ====================

/**
 * WorkflowChat 主回复 Workflow
 *
 * 编排步骤：
 * 1. createModelStep — 使用 ModelService 创建语言模型
 * 2. claimActiveStream — 幂等 claim，确保同一会话只有一个活跃 stream
 * 3. runAgentStep — 执行 Agent 推理，流式输出到客户端
 * 4. finalizeRun — 同步更新 run 状态（step 函数）
 * 5. triggerPostFinish — 触发后处理 workflow
 */
export async function workflowchatReplyWorkflow(input: WorkflowChatRunInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  // 内存累积 step timings，传给 post-finish
  const stepTimings: StepTiming[] = [];

  // ========== Step 1: createModelStep ==========
  let stepStart = Date.now();
  let modelResult: Awaited<ReturnType<typeof createModelStep>>;
  try {
    modelResult = await createModelStep(input);
    stepTimings.push({
      runId: input.runId,
      stepNumber: 0,
      stepName: "createModelStep",
      startedAt: stepStart,
      finishedAt: Date.now(),
      durationMs: Date.now() - stepStart,
      finishReason: "completed",
    });
  } catch (e) {
    stepTimings.push({
      runId: input.runId,
      stepNumber: 0,
      stepName: "createModelStep",
      startedAt: stepStart,
      finishedAt: Date.now(),
      durationMs: Date.now() - stepStart,
      finishReason: "failed",
    });
    throw e;
  }

  // ========== Step 2: claimActiveStream ==========
  stepStart = Date.now();
  await claimActiveStream(input.conversationId, workflowRunId);
  stepTimings.push({
    runId: input.runId,
    stepNumber: 1,
    stepName: "claimActiveStream",
    startedAt: stepStart,
    finishedAt: Date.now(),
    durationMs: Date.now() - stepStart,
    finishReason: "completed",
  });

  // ========== Step 3: runAgentStep ==========
  let responseMessage: UIMessage | null = null;
  let finishReason: string = "completed";
  let error: string | null = null;
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

  // 提取运行时参数和工具集合，默认值已在 agent.ts 中处理
  const maxSteps = input.maxSteps ?? 50;
  const customInstructions = input.customInstructions;
  const tools = input.tools;

  stepStart = Date.now();
  try {
    const result = await runAgentStep(input, modelResult.model, maxSteps, customInstructions, tools);
    responseMessage = result.responseMessage;
    finishReason = result.finishReason;
    usage = result.usage;
    stepTimings.push({
      runId: input.runId,
      stepNumber: 2,
      stepName: "runAgentStep",
      startedAt: stepStart,
      finishedAt: Date.now(),
      durationMs: Date.now() - stepStart,
      finishReason,
      // 记录 Token 统计
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
    });
} catch (e) {
    finishReason = "failed";
    error = e instanceof Error ? e.message : String(e);
    stepTimings.push({
      runId: input.runId,
      stepNumber: 2,
      stepName: "runAgentStep",
      startedAt: stepStart,
      finishedAt: Date.now(),
      durationMs: Date.now() - stepStart,
      finishReason: "failed",
    });
  } finally {
    // ========== Step 4: finalizeRun（step 函数，避免 sandbox 问题）==========
    // 必须通过 step 函数调用，因为 @libsql/client 在 VM sandbox 中不可用
    await finalizeRun({
      runId: input.runId,
      finishReason,
      error,
    });

    // ========== Step 5: 触发 post-finish ==========
    const postFinishInput: PostFinishInput = {
      conversationId: input.conversationId,
      runId: input.runId,
      workflowRunId,
      requestMessageId: input.requestMessageId,
      responseMessage,
      finishReason,
      error,
      userId: input.userId,
      modelId: input.modelId,
      stepTimings,
    };

    await triggerPostFinish(postFinishInput);
  }
}
