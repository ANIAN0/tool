/**
 * WorkflowChat 主回复 Workflow
 *
 * 编排流程：
 * 1. createModelStep — 使用 ModelService 创建语言模型
 * 2. claimActiveStream（双保障）— 幂等 claim active_stream_id
 * 3. runAgentStep + while 循环 — 执行多步 Agent 推理（外部循环控制）
 * 4. finalizeRun — 同步更新 run 状态（step 函数，避免 sandbox 问题）
 * 5. triggerPostFinish — 触发 post-finish 后处理
 *
 * 设计说明：
 * - while 循环在 workflow 主函数层面，每次调用 runSingleAgentStep 产生独立 step 记录
 * - runSingleAgentStep 执行一次 agent.stream()，返回 { finishReason, newMessages, responseMessage, usage }
 * - 流式输出在 workflow 主函数获取 writable，每步写入后不关闭，最终统一关闭
 *
 * 重要：所有依赖原生 Turso 客户端的 DB 操作必须在 step 函数中执行，
 * 因为 workflow 函数运行在 VM sandbox 中，require 不可用。
 */

import { getWritable, getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { convertToModelMessages } from "ai";
import type { UIMessage, UIMessageChunk, ToolSet, FinishReason } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";

import { createWorkflowChatAgent } from "@/lib/workflowchat/agent";
import { createModel } from "@/lib/infra/model";
import { claimChatActiveStreamId, updateWfChatRun, getWfChatRun } from "@/lib/workflowchat/repository";
import { loadAgentConfig } from "@/lib/workflowchat/agent-loader";
import { createAgentTools } from "@/lib/workflowchat/agent-tools";
import { WORKFLOWCHAT_RUN_STATUS } from "@/lib/workflowchat/constants";
import type { WorkflowChatRunInput, PostFinishInput } from "@/lib/workflowchat/dto";
import type { StepTiming } from "@/lib/workflowchat/constants";

import { workflowchatPostFinishWorkflow } from "./workflowchat-post-finish";

// ==================== Step 函数 ====================

/**
 * Step 1: createModelStep — 验证模型配置并返回可序列化的元数据
 *
 * 注意：LanguageModel 实例包含函数，无法通过 workflow 序列化传递。
 * 因此此 step 只验证模型存在并返回元数据，实际模型创建在 runAgentStep 内部完成。
 */
async function createModelStep(input: WorkflowChatRunInput) {
  "use step";

  const { userId, modelId } = input;

  try {
    const result = await createModel({
      modelId,
      userId: userId ?? "",
      wrapDevTools: process.env.NODE_ENV === "development",
    });

    // 只返回可序列化的数据，不返回 model 实例
    return {
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
 * 辅助函数：将工具调用结果合并到 messages
 *
 * 从 StreamTextResult 的 response.messages 中提取 ModelMessage 格式的消息
 *（包含 assistant 消息和 tool 消息），追加到当前消息列表。
 *
 * @param result - agent.stream() 的返回结果
 * @param currentMessages - 当前 ModelMessage 列表
 * @returns 合并后的新消息列表
 */
export async function buildMessagesWithToolResults(
  result: { response: PromiseLike<{ messages: ModelMessage[] }> },
  currentMessages: ModelMessage[],
): Promise<ModelMessage[]> {
  // 从 result 中获取 response.messages（已为 ModelMessage 格式）
  const response = await result.response;
  if (!response?.messages?.length) {
    return currentMessages;
  }

  // 直接追加 response messages（assistant + tool 消息）
  return [...currentMessages, ...response.messages];
}

/**
 * 单步推理结果类型
 */
interface SingleStepResult {
  finishReason: FinishReason;
  newMessages: ModelMessage[];
  responseMessage: UIMessage | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

/**
 * 运行单步 Agent 推理
 *
 * 执行一次 agent.stream() 调用，返回推理结果。
 * 此函数在 workflow 主函数的 while 循环中被多次调用。
 *
 * @param params - 推理参数
 * @param params.model - LanguageModel 实例
 * @param params.tools - Agent 工具集
 * @param params.messages - 当前消息列表
 * @param params.instructions - Agent 指令
 * @param params.writable - workflow 可写流
 * @returns 单步推理结果
 */
async function runSingleAgentStep(params: {
  model: Awaited<ReturnType<typeof createModel>>["model"];
  tools: ToolSet | undefined;
  messages: ModelMessage[];
  instructions?: string;
  writable: ReturnType<typeof getWritable<UIMessageChunk>>;
}): Promise<SingleStepResult> {
  let responseMessage: UIMessage | null = null;
  let finishReason: FinishReason = "stop";

  const agent = createWorkflowChatAgent({
    model: params.model,
    instructions: params.instructions,
    tools: params.tools,
  });

  const result = await agent.stream({
    messages: params.messages,
  });

  // 流式输出到前端（逐 chunk 写入 writable）
  for await (const part of result.toUIMessageStream({
    onFinish: async (event) => {
      responseMessage = event.responseMessage;
    },
  })) {
    const writer = params.writable.getWriter();
    try {
      await writer.write(part);
    } finally {
      writer.releaseLock();
    }
  }

  // 获取当前步的 finishReason
  finishReason = await result.finishReason;

  // 获取当前步的 Token 用量
  const stepUsage = await result.usage;
  const usage = stepUsage ? {
    promptTokens: stepUsage.inputTokens ?? 0,
    completionTokens: stepUsage.outputTokens ?? 0,
    totalTokens: stepUsage.totalTokens ?? (stepUsage.inputTokens ?? 0) + (stepUsage.outputTokens ?? 0),
  } : null;

  // 合并工具结果到 messages
  const newMessages = await buildMessagesWithToolResults(result, params.messages);

  return {
    finishReason,
    newMessages,
    responseMessage,
    usage,
  };
}

/**
 * Step 2: runAgentStep — 执行 Agent 推理（外部循环控制）
 *
 * 适配外部 while 循环的 step 函数。
 * 循环逻辑已移至 workflow 主函数，此函数仅负责初始化模型和工具。
 */
async function runAgentStep(
  input: WorkflowChatRunInput,
  instructions?: string,
) {
  "use step";

  // 在 step 函数内部创建模型（避免 LanguageModel 实例序列化问题）
  const modelResult = await createModel({
    modelId: input.modelId,
    userId: input.userId ?? "",
    wrapDevTools: process.env.NODE_ENV === "development",
  });
  const model = modelResult.model;

  // 在 step 函数内部加载 Agent 配置并创建工具（避免 Zod schema 序列化问题）
  let tools: ToolSet | undefined;
  if (input.userId) {
    const agentConfigResult = await loadAgentConfig(input.userId, input.agentId);
    if (agentConfigResult.ok && agentConfigResult.agent) {
      tools = await createAgentTools(agentConfigResult.agent, input.userId, input.conversationId, input.skills);
      console.log("[runAgentStep] 工具创建成功，工具数量:", Object.keys(tools).length);
    } else {
      console.warn("[runAgentStep] Agent 配置加载失败，使用空工具集:", agentConfigResult.error);
    }
  }

  // UIMessage[] → ModelMessage[] 转换
  const uiMessagesWithoutId = input.messages.map(({ id, ...rest }) => rest);
  const initialMessages: ModelMessage[] = await convertToModelMessages(uiMessagesWithoutId);

  return {
    model,
    tools,
    initialMessages,
  };
}

/**
 * Step 3: finalizeRun — 同步更新 run 状态
 *
 * 在主 workflow 的 finally 中调用，确保 run 状态在 post-finish 之前更新。
 * 必须是 step 函数，因为 getWfChatRun/updateWfChatRun 依赖原生 Turso 客户端，
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
 * 3. runAgentStep + while 循环 — 执行多步 Agent 推理，流式输出到客户端
 * 4. finalizeRun — 同步更新 run 状态（step 函数）
 * 5. triggerPostFinish — 触发后处理 workflow
 *
 * 设计说明：while 循环在 workflow 主函数层面，每次调用 runSingleAgentStep 产生独立 step 记录。
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
  try {
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
  } catch (e) {
    stepTimings.push({
      runId: input.runId,
      stepNumber: 1,
      stepName: "claimActiveStream",
      startedAt: stepStart,
      finishedAt: Date.now(),
      durationMs: Date.now() - stepStart,
      finishReason: "failed",
    });
    throw e;
  }

  // ========== Step 3: runAgentStep + while 循环 ==========
  let responseMessage: UIMessage | null = null;
  let finishReason: string = "completed";
  let error: string | null = null;
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

  const maxSteps = input.maxSteps ?? 50;
  const instructions = input.instructions;

  // 在 workflow 主函数获取 writable（流式输出）
  const writable = getWritable<UIMessageChunk>();

  // 累积 Token 用量（跨多步累加）
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;

  let stepCount = 0;
  let currentMessages: ModelMessage[] = [];
  let model: Awaited<ReturnType<typeof createModel>>["model"] | null = null;
  let tools: ToolSet | undefined;

  try {
    // 调用 runAgentStep 获取 model 和 tools（step 函数）
    const agentInitResult = await runAgentStep(input, instructions);
    model = agentInitResult.model;
    tools = agentInitResult.tools;
    currentMessages = agentInitResult.initialMessages;

    // workflow 层面的 while 循环：每次调用 runSingleAgentStep 产生独立 step 记录
    while (stepCount < maxSteps) {
      if (!model) {
        throw new Error("Model not initialized");
      }

      // 每步独立记录 timing
      stepStart = Date.now();
      let stepFinishReason: string = "completed";

      try {
        // 执行单步推理
        const stepResult = await runSingleAgentStep({
          model,
          tools,
          messages: currentMessages,
          instructions,
          writable,
        });

        // 更新 messages（包含工具调用结果）
        currentMessages = stepResult.newMessages;
        responseMessage = stepResult.responseMessage;
        stepFinishReason = stepResult.finishReason;

        // 累积 Token 用量
        if (stepResult.usage) {
          totalPromptTokens += stepResult.usage.promptTokens;
          totalCompletionTokens += stepResult.usage.completionTokens;
          totalTokens += stepResult.usage.totalTokens;
        }

        // 记录每步 timing
        stepTimings.push({
          runId: input.runId,
          stepNumber: 2 + stepCount,
          stepName: "runSingleAgentStep",
          startedAt: stepStart,
          finishedAt: Date.now(),
          durationMs: Date.now() - stepStart,
          finishReason: stepFinishReason,
          promptTokens: stepResult.usage?.promptTokens,
          completionTokens: stepResult.usage?.completionTokens,
          totalTokens: stepResult.usage?.totalTokens,
        });

        // 根据 finishReason 决定是否继续循环
        if (stepFinishReason === "tool-calls") {
          // Agent 调用了工具，继续循环
          stepCount++;
          console.log(`[workflowchatReplyWorkflow] 工具调用完成，当前步数: ${stepCount}/${maxSteps}`);
        } else if (stepFinishReason === "stop") {
          // Agent 完成推理，退出循环
          finishReason = "stop";
          break;
        } else {
          // 其他情况（length/error），退出循环
          finishReason = stepFinishReason;
          break;
        }
      } catch (e) {
        // 单步执行失败，记录 timing 并退出
        stepTimings.push({
          runId: input.runId,
          stepNumber: 2 + stepCount,
          stepName: "runSingleAgentStep",
          startedAt: stepStart,
          finishedAt: Date.now(),
          durationMs: Date.now() - stepStart,
          finishReason: "failed",
        });
        throw e;
      }
    }

    // 达到 maxSteps 限制
    if (stepCount >= maxSteps) {
      console.warn(`[workflowchatReplyWorkflow] 达到最大步数限制: ${maxSteps}，强制结束`);
      finishReason = "maxSteps";
    }

    // 组装 usage
    usage = totalTokens > 0 ? {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens,
    } : null;
  } catch (e) {
    finishReason = "failed";
    error = e instanceof Error ? e.message : String(e);
  } finally {
    // 关闭流，通知消费者流已完成
    // 每步写入后不关闭，最终统一关闭
    await writable.close();

    // ========== Step 4: finalizeRun（step 函数，避免 sandbox 问题）==========
    // 必须通过 step 函数调用，因为原生 Turso 客户端在 VM sandbox 中不可用
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
