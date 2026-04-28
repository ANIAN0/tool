/**
 * WorkflowChat Post-finish Workflow
 *
 * 主 workflow 完成后的后处理流程，包含 5 个步骤：
 * 1. persistAssistantMessage — 将 assistant 消息落库
 * 2. persistRunResult — 更新 run 状态为 completed/failed
 * 3. persistRunSteps — 批量写入 step 耗时数据
 * 4. clearActiveStream — CAS 清除，带重试
 * 5. recordWorkflowUsage — 汇总并持久化 token 统计到 workflowchat_runs
 */

import { sleep } from "workflow";
import { nanoid } from "nanoid";
import type { PostFinishInput } from "@/lib/workflowchat/dto";
import {
  createWfChatMessage,
  updateWfChatRun,
  createWfChatRunStep,
  updateWfChatRunStep,
  compareAndSetActiveStreamId,
  getWfChatRun,
} from "@/lib/workflowchat/repository";
import { WORKFLOWCHAT_RUN_STATUS, WORKFLOWCHAT_STEP_STATUS } from "@/lib/workflowchat/constants";

// ==================== Step 函数 ====================

/**
 * Step 1: persistAssistantMessage
 *
 * 仅在 responseMessage 非空时执行：
 * - 将 assistant 消息落库到 workflowchat_messages
 * - 更新 workflowchat_runs.response_message_id
 * 当 responseMessage === null（主 workflow 失败）时，跳过此步骤
 */
async function persistAssistantMessage(input: PostFinishInput) {
  "use step";

  const { responseMessage, conversationId, runId } = input;
  if (!responseMessage) return;

  // 将 parts 序列化为 JSON 字符串存储
  const partsJson = JSON.stringify(responseMessage.parts);

  // 使用 nanoid 生成独立 ID，避免 responseMessage.id 为空字符串导致冲突
  const messageId = nanoid();

  // 落库 assistant 消息
  await createWfChatMessage({
    id: messageId,
    conversationId,
    runId,
    role: "assistant",
    parts: partsJson,
  });

  // 更新 run 的 response_message_id
  await updateWfChatRun(runId, {
    responseMessageId: messageId,
  });
}

/**
 * Step 2: persistRunResult
 *
 * 更新 run 状态为 completed / failed。
 * 注意：主 workflow 已在 finally 中直接更新了 run 状态，
 * 此处是防御性重复写入，确保即使主 workflow 异常退出也能最终更新。
 */
async function persistRunResult(input: PostFinishInput) {
  "use step";

  const now = Date.now();

  // 根据完成原因确定状态
  const isFailed = input.finishReason === "failed";
  const status = isFailed
    ? WORKFLOWCHAT_RUN_STATUS.FAILED
    : WORKFLOWCHAT_RUN_STATUS.COMPLETED;

  // 失败时直接使用 error 字符串
  const errorJson = isFailed && input.error != null
    ? JSON.stringify({ message: input.error })
    : null;

  // 计算 total_duration_ms：finished_at - started_at
  const run = await getWfChatRun(input.runId);
  const totalDurationMs = run?.started_at != null
    ? now - run.started_at
    : null;

  await updateWfChatRun(input.runId, {
    status,
    finishedAt: now,
    totalDurationMs,
    errorJson,
  });
}

/**
 * Step 3: persistRunSteps
 *
 * 将 stepTimings 批量写入 workflowchat_run_steps
 * 包含 step 耗时数据和 Token 统计
 */
async function persistRunSteps(input: PostFinishInput) {
  "use step";

  const { stepTimings, runId } = input;
  if (!stepTimings.length) return;

  // 逐条创建 step 记录
  for (const timing of stepTimings) {
    const stepStatus = timing.finishReason === "failed"
      ? WORKFLOWCHAT_STEP_STATUS.FAILED
      : WORKFLOWCHAT_STEP_STATUS.COMPLETED;

    // 生成 step id：runId + stepNumber 组合
    const stepId = `${runId}-step-${timing.stepNumber}`;

    // 先创建 step 基础记录
    await createWfChatRunStep({
      id: stepId,
      workflowRunId: runId,
      stepNumber: timing.stepNumber,
      stepName: timing.stepName,
    });

    // 再更新耗时、状态和 Token 统计数据
    await updateWfChatRunStep(stepId, {
      status: stepStatus,
      startedAt: timing.startedAt,
      finishedAt: timing.finishedAt,
      durationMs: timing.durationMs,
      finishReason: timing.finishReason,
      // 持久化 Token 统计
      promptTokens: timing.promptTokens,
      completionTokens: timing.completionTokens,
      totalTokens: timing.totalTokens,
    });
  }
}

/**
 * Step 4: clearActiveStream
 *
 * CAS 清除 active_stream_id，带重试：
 * - 最多重试 3 次，每次间隔 50ms
 * - 使用 compareAndSetActiveStreamId CAS 清除
 * - 重试耗尽后放弃但不抛异常
 * - 兜底由 stream 端点和新请求 reconcile 覆盖
 */
async function clearActiveStream(input: PostFinishInput) {
  "use step";

  const { conversationId, workflowRunId } = input;
  const MAX_RETRIES = 3;
  const RETRY_INTERVAL_MS = 50;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // CAS 清除：仅当 active_stream_id 等于当前 workflowRunId 时才置 null
    const success = await compareAndSetActiveStreamId(
      conversationId,
      workflowRunId,
      null,
    );
    if (success) return;

    // 未成功则等待后重试（使用 workflow sleep，sandbox 中 setTimeout 不可用）
    if (attempt < MAX_RETRIES - 1) {
      await sleep(`${RETRY_INTERVAL_MS}ms`);
    }
  }

  // 重试耗尽，放弃但不抛异常
  // 兜底由 stream 端点和新请求 reconcile 覆盖
}

/**
 * Step 5: recordWorkflowUsage
 *
 * 汇总所有 step 的 Token 使用情况并持久化到 workflowchat_runs 表
 * 计算整个 workflow run 的 token 消耗总和
 */
async function recordWorkflowUsage(input: PostFinishInput) {
  "use step";

  const { stepTimings, runId } = input;
  if (!stepTimings.length) return;

  // 汇总所有 step 的 token 使用情况
  const totalUsage = stepTimings.reduce(
    (acc, step) => ({
      promptTokens: acc.promptTokens + (step.promptTokens ?? 0),
      completionTokens: acc.completionTokens + (step.completionTokens ?? 0),
      totalTokens: acc.totalTokens + (step.totalTokens ?? 0),
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );

  // 持久化到 workflowchat_runs 表
  await updateWfChatRun(runId, {
    promptTokens: totalUsage.promptTokens,
    completionTokens: totalUsage.completionTokens,
    totalTokens: totalUsage.totalTokens,
  });

  // 日志记录（可选，便于调试）
  console.log(`[recordWorkflowUsage] Run ${runId} Token 持久化完成:`, {
    promptTokens: totalUsage.promptTokens,
    completionTokens: totalUsage.completionTokens,
    totalTokens: totalUsage.totalTokens,
  });
}

// ==================== 主 Workflow ====================

/**
 * WorkflowChat Post-finish Workflow
 *
 * 主 workflow 完成后的后处理编排：
 * - 仅在 responseMessage 非空时持久化 assistant 消息
 * - 更新 run 状态和结果
 * - 批量写入 step 数据
 * - CAS 清除 active_stream_id（带重试）
 * - 记录 usage 数据
 */
export async function workflowchatPostFinishWorkflow(input: PostFinishInput) {
  "use workflow";

  if (input.responseMessage) {
    await persistAssistantMessage(input);
  }
  await persistRunResult(input);
  await persistRunSteps(input);
  await clearActiveStream(input);
  await recordWorkflowUsage(input);
}
