/**
 * WorkflowChat 服务层
 * 封装会话管理、消息处理、run 创建、active stream 协调等业务逻辑
 */

import { nanoid } from 'nanoid';
import { start, getRun } from 'workflow/api';
import type { Run } from 'workflow/api';
import type { UIMessage } from 'ai';

import { workflowchatReplyWorkflow } from '@/app/workflows/workflowchat';

import {
  createWfChatConversation,
  getWfChatConversation,
  getWfChatConversationsByUserId,
  getAllWfChatConversations,
  updateWfChatConversation,
  deleteWfChatConversation,
  touchWfChatConversation,
  claimChatActiveStreamId,
  compareAndSetActiveStreamId,
  createWfChatMessage,
  getWfChatMessagesByConversationId,
  createWfChatRun,
  getWfChatRun,
  getWfChatRunByWorkflowRunId,
  getWfChatRunsByConversationId,
  updateWfChatRun,
} from './repository';
import {
  WORKFLOWCHAT_REPLY_WORKFLOW_NAME,
  WORKFLOWCHAT_RUN_STATUS,
} from './constants';
import { resolveWorkflowChatModel } from './model-resolver';
import { resolveWorkflowChatModelId } from './model-resolver';
import type {
  ConversationDTO,
  MessageDTO,
  RunDTO,
  ConversationDetailDTO,
  WorkflowChatRunInput,
} from './dto';
import type {
  WorkflowChatConversation,
  WorkflowChatMessage,
  WorkflowChatRun,
} from '@/lib/schemas/workflowchat';

// ==================== 终态集合 ====================

/** run 终态集合：completed 或 failed */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  WORKFLOWCHAT_RUN_STATUS.COMPLETED,
  WORKFLOWCHAT_RUN_STATUS.FAILED,
]);

// ==================== 实体 → DTO 转换 ====================

function conversationToDTO(conv: WorkflowChatConversation): ConversationDTO {
  return {
    id: conv.id,
    userId: conv.user_id,
    title: conv.title,
    status: conv.status,
    activeStreamId: conv.active_stream_id,
    lastMessageAt: conv.last_message_at,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
  };
}

function messageToDTO(msg: WorkflowChatMessage): MessageDTO {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    runId: msg.run_id,
    role: msg.role,
    parts: msg.parts,
    createdAt: msg.created_at,
  };
}

function runToDTO(run: WorkflowChatRun): RunDTO {
  return {
    id: run.id,
    conversationId: run.conversation_id,
    workflowRunId: run.workflow_run_id,
    workflowName: run.workflow_name,
    modelId: run.model_id,
    requestMessageId: run.request_message_id,
    responseMessageId: run.response_message_id,
    status: run.status,
    errorJson: run.error_json,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    totalDurationMs: run.total_duration_ms,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}

// ==================== 自定义错误 ====================

/** 发送消息时遇到冲突（CAS claim 失败或已有活跃 run） */
export class SendMessageConflictError extends Error {
  constructor(
    message: string,
    public readonly existingRun: RunDTO | null,
  ) {
    super(message);
    this.name = 'SendMessageConflictError';
  }
}

/** 发送消息时遇到环境变量缺失 */
export class SendMessageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SendMessageConfigError';
  }
}

// ==================== reconcileExistingActiveStream ====================

/**
 * reconcile stale activeStreamId
 *
 * 检查会话的 active_stream_id 是否有残留：
 * 1. 如果 active_stream_id 为空，直接返回
 * 2. 查找对应的 run，如果 run 已终态，CAS 清除并返回
 * 3. 如果 run 存在且仍在运行，返回 run 信息（由调用方处理重连）
 * 4. 如果找不到对应 run 记录，直接清除残留
 *
 * @param conversationId - 会话 id
 * @returns 如果发现仍在运行的活跃 run，返回其 DTO；否则返回 null
 */
export async function reconcileExistingActiveStream(
  conversationId: string,
): Promise<RunDTO | null> {
  // 读取会话，获取 active_stream_id
  const conversation = await getWfChatConversation(conversationId);
  if (!conversation || !conversation.active_stream_id) {
    return null;
  }

  const activeStreamId = conversation.active_stream_id;

  // 尝试通过 workflow_run_id 查找 run
  const run = await getWfChatRunByWorkflowRunId(activeStreamId);

  if (!run) {
    // 找不到对应 run 记录，CAS 清除残留（避免竞态抹掉新 claim）
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return null;
  }

  // run 已终态，CAS 清除 stale activeStreamId
  if (TERMINAL_STATUSES.has(run.status)) {
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return null;
  }

  // run 仍在运行，返回 run 信息供调用方处理重连
  return runToDTO(run);
}

// ==================== 业务函数 ====================

/**
 * sendMessage 完整流程
 *
 * 1. 写入 user message
 * 2. 创建 run 记录（status=pending，workflow_run_id 为 null）
 * 3. reconcileExistingActiveStream：检查 active_stream_id 是否有 stale 残留
 * 4. 如果 active_stream_id 非空且对应 run 仍在运行，重连已有 stream
 * 5. start(workflowchatReplyWorkflow) 启动 workflow
 * 6. claimChatActiveStreamId CAS claim（双保障第一层）
 * 7. 如果 CAS 失败（slot 已被其他 run 占用），取消刚启动的 workflow，返回 409
 * 8. 回填 workflow_run_id 到 run 记录
 * 9. 返回 SendMessageResult
 *
 * @param conversationId - 会话 id
 * @param userId - 用户 id，首版可为 null
 * @param content - 消息内容（AI SDK UIMessage 格式的 parts JSON 字符串）
 * @param modelId - 可选模型 id，不传时使用环境变量默认值
 * @returns SendMessageResult 包含 run 信息和 workflow Run 句柄
 * @throws SendMessageConflictError - CAS claim 失败或已有活跃 run
 * @throws SendMessageConfigError - 环境变量缺失
 */
export async function sendMessage(
  conversationId: string,
  userId: string | null,
  content: string,
  modelId?: string,
): Promise<{ runDTO: RunDTO; workflowRun: Run<unknown> }> {
  console.log("[sendMessage] 入口, conversationId:", conversationId, "content:", content.slice(0, 100), "modelId:", modelId);

  // 验证会话存在
  const conversation = await getWfChatConversation(conversationId);
  if (!conversation) {
    throw new Error(`会话不存在: ${conversationId}`);
  }

  // 解析模型 ID（校验环境变量 + 获取 modelId）
  let resolvedModelId: string;
  try {
    resolvedModelId = resolveWorkflowChatModelId(modelId);
  } catch {
    throw new SendMessageConfigError(
      '环境变量缺失：WORKFLOWCHAT_API_KEY 或 WORKFLOWCHAT_MODEL 未配置',
    );
  }

  // 步骤 1：写入 user message
  const userMessageId = nanoid();
  await createWfChatMessage({
    id: userMessageId,
    conversationId,
    runId: null,
    role: 'user',
    parts: content,
  });

  // 更新会话最后消息时间
  await touchWfChatConversation(conversationId);

  // 步骤 2：创建 run 记录（status=pending，workflow_run_id 为 null）
  const runId = nanoid();
  const run = await createWfChatRun({
    id: runId,
    conversationId,
    workflowRunId: null,
    workflowName: WORKFLOWCHAT_REPLY_WORKFLOW_NAME,
    modelId: resolvedModelId,
    requestMessageId: userMessageId,
  });

  // 步骤 3：reconcile stale activeStreamId
  const activeRun = await reconcileExistingActiveStream(conversationId);

  // 步骤 4：如果 active run 仍在运行，标记刚创建的 run 为 failed 并返回冲突
  if (activeRun) {
    await updateWfChatRun(runId, {
      status: WORKFLOWCHAT_RUN_STATUS.FAILED,
      errorJson: JSON.stringify({
        message: `会话 ${conversationId} 已有活跃 run: ${activeRun.id}，跳过执行`,
      }),
      finishedAt: Date.now(),
    });
    throw new SendMessageConflictError(
      `会话 ${conversationId} 已有活跃 run: ${activeRun.id}`,
      activeRun,
    );
  }

  // 组装 workflow 输入参数
  // 获取会话消息历史（含刚写入的 user message）
  const messages = await getWfChatMessagesByConversationId(conversationId);

  // 将消息转为 UIMessage 格式供 ToolLoopAgent 使用
  const uiMessages: UIMessage[] = messages.map((msg) => {
    let parts: UIMessage['parts'];
    try {
      parts = JSON.parse(msg.parts);
    } catch {
      // 解析失败时退化为纯文本
      parts = [{ type: 'text' as const, text: msg.parts }];
    }

    return {
      id: msg.id,
      role: msg.role as UIMessage['role'],
      parts,
      createdAt: new Date(msg.created_at),
    };
  });

  const workflowInput: WorkflowChatRunInput = {
    conversationId,
    runId,
    requestMessageId: userMessageId,
    userId,
    modelId: resolvedModelId,
    messages: uiMessages,
  };

  console.log("[sendMessage] workflowInput.messages 数量:", uiMessages.length);
  console.log("[sendMessage] workflowInput.messages 详情:", JSON.stringify(uiMessages.map(m => ({ role: m.role, partsPreview: JSON.stringify(m.parts).slice(0, 200) }))));

  // 步骤 5：启动 workflow
  // 注意：主 workflow 文件（T3-6）还未实现，此处调用签名已写好
  // workflow 函数将在 app/workflows/workflowchat.ts 中定义
  let workflowRun: Run<unknown>;
  try {
    workflowRun = await start(
      workflowchatReplyWorkflow,
      [workflowInput],
    );
  } catch (error) {
    // start(...) 失败，标记 run 为 failed
    await updateWfChatRun(runId, {
      status: WORKFLOWCHAT_RUN_STATUS.FAILED,
      errorJson: JSON.stringify({
        message: '启动 workflow 失败',
        error: String(error),
      }),
      finishedAt: Date.now(),
    });
    throw new Error(`启动 workflow 失败: ${String(error)}`);
  }

  // 步骤 6：CAS claim active_stream_id
  const claimSuccess = await claimChatActiveStreamId(
    conversationId,
    workflowRun.runId,
  );

  // 步骤 7：CAS 失败，取消刚启动的 workflow，返回 409
  if (!claimSuccess) {
    // 取消刚启动的 workflow
    await workflowRun.cancel();

    // 标记 run 为 failed
    await updateWfChatRun(runId, {
      status: WORKFLOWCHAT_RUN_STATUS.FAILED,
      errorJson: JSON.stringify({
        message: 'CAS claim 失败，active_stream_id 已被其他 run 占用',
      }),
      finishedAt: Date.now(),
    });

    throw new SendMessageConflictError(
      `CAS claim 失败，会话 ${conversationId} 的 active_stream_id 已被其他 run 占用`,
      null,
    );
  }

  // 步骤 8：回填 workflow_run_id 到 run 记录
  await updateWfChatRun(runId, {
    workflowRunId: workflowRun.runId,
    status: WORKFLOWCHAT_RUN_STATUS.RUNNING,
    startedAt: Date.now(),
  });

  // 步骤 9：返回结果
  const updatedRun = await getWfChatRun(runId);
  return {
    runDTO: runToDTO(updatedRun!),
    workflowRun,
  };
}

/**
 * 启动消息流程的简化入口
 * 仅启动 workflow 并返回 Run 和 workflowRunId，不关心流式输出
 * 适用于 sendMessage 后由 API 路由层处理流式响应的场景
 */
export async function startWorkflowRun(
  conversationId: string,
  userId: string | null,
  content: string,
  modelId?: string,
): Promise<{ runDTO: RunDTO; workflowRun: Run<unknown> }> {
  return sendMessage(conversationId, userId, content, modelId);
}

/**
 * 重连已有的活跃 workflow run
 *
 * 通过 workflow_run_id 获取 Run 句柄，用于流式响应重连
 *
 * @param workflowRunId - World 侧的 workflow run id
 * @returns Run 句柄
 */
export async function reconnectWorkflowRun(
  workflowRunId: string,
): Promise<Run<unknown>> {
  return getRun(workflowRunId);
}

// ==================== 会话管理 ====================

/**
 * 创建会话
 */
export async function createConversation(
  userId?: string | null,
  title?: string | null,
): Promise<ConversationDTO> {
  const conversation = await createWfChatConversation({
    id: nanoid(),
    userId,
    title,
  });
  return conversationToDTO(conversation);
}

/**
 * 获取会话详情（含消息历史和 activeStreamId）
 */
export async function getConversationDetail(
  conversationId: string,
): Promise<ConversationDetailDTO | null> {
  const conversation = await getWfChatConversation(conversationId);
  if (!conversation) return null;

  const messages = await getWfChatMessagesByConversationId(conversationId);

  return {
    conversation: conversationToDTO(conversation),
    messages: messages.map(messageToDTO),
    activeStreamId: conversation.active_stream_id,
  };
}

/**
 * 获取用户的会话列表
 */
export async function listConversationsByUserId(
  userId: string,
): Promise<ConversationDTO[]> {
  const conversations = await getWfChatConversationsByUserId(userId);
  return conversations.map(conversationToDTO);
}

/**
 * 获取所有会话列表（首版不强制登录）
 */
export async function listAllConversations(): Promise<ConversationDTO[]> {
  const conversations = await getAllWfChatConversations();
  return conversations.map(conversationToDTO);
}

/**
 * 更新会话标题
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<ConversationDTO | null> {
  const conversation = await updateWfChatConversation(conversationId, { title });
  return conversation ? conversationToDTO(conversation) : null;
}

/**
 * 归档会话
 */
export async function archiveConversation(
  conversationId: string,
): Promise<ConversationDTO | null> {
  const conversation = await updateWfChatConversation(conversationId, {
    status: 'archived',
  });
  return conversation ? conversationToDTO(conversation) : null;
}

/**
 * 删除会话
 */
export async function deleteConversation(
  conversationId: string,
): Promise<boolean> {
  return deleteWfChatConversation(conversationId);
}

// ==================== Run 查询 ====================

/**
 * 获取 run 信息（按 id）
 */
export async function getRunById(
  runId: string,
): Promise<RunDTO | null> {
  const run = await getWfChatRun(runId);
  return run ? runToDTO(run) : null;
}

/**
 * 获取 run 信息（按 workflow_run_id）
 */
export async function getRunByWorkflowRunId(
  workflowRunId: string,
): Promise<RunDTO | null> {
  const run = await getWfChatRunByWorkflowRunId(workflowRunId);
  return run ? runToDTO(run) : null;
}

/**
 * 获取会话的 run 列表
 */
export async function listRunsByConversationId(
  conversationId: string,
): Promise<RunDTO[]> {
  const runs = await getWfChatRunsByConversationId(conversationId);
  return runs.map(runToDTO);
}

// ==================== 流式响应辅助 ====================

/**
 * 获取活跃 stream 的重连句柄
 *
 * 当页面刷新或重连时，根据会话的 active_stream_id 获取 workflow Run 句柄：
 * - 如果有活跃 stream 且对应 run 仍在运行，返回 Run 句柄供重连
 * - 如果有 active_stream_id 但对应 run 已终态，清除 stale 并返回 null
 * - 如果没有 active_stream_id，返回 null
 *
 * @param conversationId - 会话 id
 * @returns Run 句柄（可继续流式消费）或 null
 */
export async function getActiveStreamRun(
  conversationId: string,
): Promise<Run<unknown> | null> {
  const conversation = await getWfChatConversation(conversationId);
  if (!conversation || !conversation.active_stream_id) {
    return null;
  }

  const activeStreamId = conversation.active_stream_id;

  // 尝试查找对应的 run
  const run = await getWfChatRunByWorkflowRunId(activeStreamId);
  if (!run) {
    // 找不到 run 记录，CAS 清除残留（避免竞态抹掉新 claim）
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return null;
  }

  // run 已终态，清除 stale activeStreamId
  if (TERMINAL_STATUSES.has(run.status)) {
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return null;
  }

  // run 仍在运行，获取 Run 句柄
  try {
    return getRun(activeStreamId);
  } catch {
    // Run 不存在于 World 侧，CAS 清除残留（避免竞态抹掉新 claim）
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return null;
  }
}

