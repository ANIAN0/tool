import { getDb } from '@/lib/db/client';
import type {
  WorkflowChatConversation,
  WorkflowChatMessage,
  WorkflowChatRun,
  WorkflowChatRunStep,
  WorkflowChatConversationStatus,
  WorkflowChatRunStatus,
  WorkflowChatStepStatus,
} from '@/lib/schemas/workflowchat';

// ==================== Row 转换函数 ====================

function rowToWfChatConversation(row: Record<string, unknown>): WorkflowChatConversation {
  return {
    id: row.id as string,
    user_id: row.user_id as string | null,
    agent_id: row.agent_id as string,
    title: row.title as string | null,
    status: row.status as WorkflowChatConversationStatus,
    active_stream_id: row.active_stream_id as string | null,
    last_message_at: row.last_message_at as number,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    total_input_tokens: (row.total_input_tokens as number) ?? 0,
    total_output_tokens: (row.total_output_tokens as number) ?? 0,
    total_tokens: (row.total_tokens as number) ?? 0,
  };
}

function rowToWfChatMessage(row: Record<string, unknown>): WorkflowChatMessage {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    run_id: row.run_id as string | null,
    role: row.role as 'user' | 'assistant' | 'system',
    parts: row.parts as string,
    created_at: row.created_at as number,
  };
}

function rowToWfChatRun(row: Record<string, unknown>): WorkflowChatRun {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    workflow_run_id: row.workflow_run_id as string | null,
    workflow_name: row.workflow_name as string,
    model_id: row.model_id as string,
    request_message_id: row.request_message_id as string,
    response_message_id: row.response_message_id as string | null,
    status: row.status as WorkflowChatRunStatus,
    error_json: row.error_json as string | null,
    started_at: row.started_at as number | null,
    finished_at: row.finished_at as number | null,
    total_duration_ms: row.total_duration_ms as number | null,
    prompt_tokens: row.prompt_tokens as number ?? 0,
    completion_tokens: row.completion_tokens as number ?? 0,
    total_tokens: row.total_tokens as number ?? 0,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

function rowToWfChatRunStep(row: Record<string, unknown>): WorkflowChatRunStep {
  return {
    id: row.id as string,
    workflow_run_id: row.workflow_run_id as string,
    step_number: row.step_number as number,
    step_name: row.step_name as string,
    status: row.status as WorkflowChatStepStatus,
    started_at: row.started_at as number | null,
    finished_at: row.finished_at as number | null,
    duration_ms: row.duration_ms as number | null,
    finish_reason: row.finish_reason as string | null,
    prompt_tokens: row.prompt_tokens as number | undefined,
    completion_tokens: row.completion_tokens as number | undefined,
    total_tokens: row.total_tokens as number | undefined,
    created_at: row.created_at as number,
  };
}

// ==================== Conversations CRUD ====================

export async function createWfChatConversation(params: {
  id: string;
  userId?: string | null;
  agentId: string;
  title?: string | null;
}): Promise<WorkflowChatConversation> {
  const db = getDb();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO workflowchat_conversations (id, user_id, agent_id, title, status, active_stream_id, last_message_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', NULL, ?, ?, ?)`,
    args: [params.id, params.userId ?? null, params.agentId, params.title ?? null, now, now, now],
  });

  return {
    id: params.id,
    user_id: params.userId ?? null,
    agent_id: params.agentId,
    title: params.title ?? null,
    status: 'active',
    active_stream_id: null,
    last_message_at: now,
    created_at: now,
    updated_at: now,
  };
}

export async function getWfChatConversation(id: string): Promise<WorkflowChatConversation | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_conversations WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToWfChatConversation(result.rows[0] as Record<string, unknown>);
}

export async function getWfChatConversationsByUserId(userId: string): Promise<WorkflowChatConversation[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_conversations WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return result.rows.map(row => rowToWfChatConversation(row as Record<string, unknown>));
}

/** 获取所有会话列表（首版不强制登录，无 userId 筛选） */
export async function getAllWfChatConversations(): Promise<WorkflowChatConversation[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_conversations ORDER BY updated_at DESC',
    args: [],
  });
  return result.rows.map(row => rowToWfChatConversation(row as Record<string, unknown>));
}

export async function updateWfChatConversation(
  id: string,
  data: { 
    title?: string; 
    status?: WorkflowChatConversationStatus;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalTokens?: number;
  }
): Promise<WorkflowChatConversation | null> {
  const db = getDb();
  const now = Date.now();
  const updates: string[] = ['updated_at = ?'];
  const args: (string | number | null)[] = [now];

  if (data.title !== undefined) {
    updates.push('title = ?');
    args.push(data.title);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    args.push(data.status);
  }
  if (data.totalInputTokens !== undefined) {
    updates.push('total_input_tokens = ?');
    args.push(data.totalInputTokens);
  }
  if (data.totalOutputTokens !== undefined) {
    updates.push('total_output_tokens = ?');
    args.push(data.totalOutputTokens);
  }
  if (data.totalTokens !== undefined) {
    updates.push('total_tokens = ?');
    args.push(data.totalTokens);
  }

  args.push(id);

  const result = await db.execute({
    sql: `UPDATE workflowchat_conversations SET ${updates.join(', ')} WHERE id = ?`,
    args,
  });

  if (result.rowsAffected === 0) return null;
  return getWfChatConversation(id);
}

/**
 * 累计更新会话的 token 统计
 * 在 run 完成后调用，将本次 token 累加到会话的累计 token 中
 */
export async function updateWfChatConversationTokens(
  id: string,
  inputTokens: number,
  outputTokens: number
): Promise<WorkflowChatConversation | null> {
  const db = getDb();
  const now = Date.now();
  
  // 获取当前累计值
  const conversation = await getWfChatConversation(id);
  if (!conversation) {
    return null;
  }

  const newTotalInputTokens = conversation.total_input_tokens + inputTokens;
  const newTotalOutputTokens = conversation.total_output_tokens + outputTokens;
  const newTotalTokens = newTotalInputTokens + newTotalOutputTokens;

  const result = await db.execute({
    sql: `UPDATE workflowchat_conversations 
          SET total_input_tokens = ?, total_output_tokens = ?, total_tokens = ?, updated_at = ?
          WHERE id = ?`,
    args: [newTotalInputTokens, newTotalOutputTokens, newTotalTokens, now, id],
  });

  if (result.rowsAffected === 0) return null;
  return getWfChatConversation(id);
}

export async function deleteWfChatConversation(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: 'DELETE FROM workflowchat_conversations WHERE id = ?',
    args: [id],
  });
  return result.rowsAffected > 0;
}

/** 更新会话的最后消息时间戳 */
export async function touchWfChatConversation(id: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.execute({
    sql: 'UPDATE workflowchat_conversations SET last_message_at = ?, updated_at = ? WHERE id = ?',
    args: [now, now, id],
  });
}

// ==================== CAS 操作 ====================

/**
 * 幂等 claim：slot 为空或已被自己占用时成功
 * 使用 UPDATE ... WHERE ... RETURNING 判断是否成功
 * @returns true 表示 claim 成功，false 表示 slot 被他人占用
 */
export async function claimChatActiveStreamId(
  chatId: string,
  workflowRunId: string
): Promise<boolean> {
  const db = getDb();
  const now = Date.now();

  const result = await db.execute({
    sql: `UPDATE workflowchat_conversations
          SET active_stream_id = ?, updated_at = ?
          WHERE id = ?
            AND (active_stream_id IS NULL OR active_stream_id = ?)
          RETURNING id`,
    args: [workflowRunId, now, chatId, workflowRunId],
  });

  // 通过 RETURNING 是否返回行判断 CAS 是否成功
  return result.rows.length > 0;
}

/**
 * 严格 CAS：仅当 active_stream_id 等于 expectedStreamId 时更新为 nextStreamId
 * 使用 UPDATE ... WHERE ... RETURNING 判断是否成功
 * @returns true 表示 CAS 成功，false 表示当前值不匹配
 */
export async function compareAndSetActiveStreamId(
  chatId: string,
  expectedStreamId: string | null,
  nextStreamId: string | null
): Promise<boolean> {
  const db = getDb();
  const now = Date.now();

  if (expectedStreamId === null) {
    const result = await db.execute({
      sql: `UPDATE workflowchat_conversations
            SET active_stream_id = ?, updated_at = ?
            WHERE id = ?
              AND active_stream_id IS NULL
            RETURNING id`,
      args: [nextStreamId, now, chatId],
    });
    return result.rows.length > 0;
  }

  const result = await db.execute({
    sql: `UPDATE workflowchat_conversations
          SET active_stream_id = ?, updated_at = ?
          WHERE id = ?
            AND active_stream_id = ?
          RETURNING id`,
    args: [nextStreamId, now, chatId, expectedStreamId],
  });

  return result.rows.length > 0;
}

/**
 * 直接清除 active_stream_id（兜底场景，run 已确认终态）
 * 仅设置 active_stream_id = NULL，无条件清除
 */
export async function clearActiveStreamId(
  chatId: string
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.execute({
    sql: `UPDATE workflowchat_conversations
          SET active_stream_id = NULL, updated_at = ?
          WHERE id = ?`,
    args: [now, chatId],
  });
}

// ==================== Messages CRUD ====================

export async function createWfChatMessage(params: {
  id: string;
  conversationId: string;
  runId?: string | null;
  role: 'user' | 'assistant' | 'system';
  parts: string;
}): Promise<WorkflowChatMessage> {
  const db = getDb();
  const now = Date.now();

  // 使用 INSERT OR IGNORE 支持 step 重试幂等
  await db.execute({
    sql: `INSERT OR IGNORE INTO workflowchat_messages (id, conversation_id, run_id, role, parts, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.conversationId, params.runId ?? null, params.role, params.parts, now],
  });

  return {
    id: params.id,
    conversation_id: params.conversationId,
    run_id: params.runId ?? null,
    role: params.role,
    parts: params.parts,
    created_at: now,
  };
}

export async function getWfChatMessage(id: string): Promise<WorkflowChatMessage | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_messages WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToWfChatMessage(result.rows[0] as Record<string, unknown>);
}

export async function getWfChatMessagesByConversationId(conversationId: string): Promise<WorkflowChatMessage[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    args: [conversationId],
  });
  return result.rows.map(row => rowToWfChatMessage(row as Record<string, unknown>));
}

export async function deleteWfChatMessagesByConversationId(conversationId: string): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: 'DELETE FROM workflowchat_messages WHERE conversation_id = ?',
    args: [conversationId],
  });
  return result.rowsAffected;
}

/**
 * 级联删除：从指定消息开始（包括该消息）删除该会话的所有后续消息
 * 用于消息编辑场景：删除指定消息及其后续消息
 */
export async function deleteWfChatMessagesFromId(
  conversationId: string,
  messageId: string,
): Promise<number> {
  const db = getDb();

  // 获取目标消息的创建时间戳
  const targetMsg = await getWfChatMessage(messageId);
  if (!targetMsg) {
    return 0;
  }

  // 删除该会话中 created_at >= target_created_at 的所有消息
  const result = await db.execute({
    sql: `DELETE FROM workflowchat_messages 
          WHERE conversation_id = ? AND created_at >= ?`,
    args: [conversationId, targetMsg.created_at],
  });

  return result.rowsAffected;
}

// ==================== Runs CRUD ====================

export async function createWfChatRun(params: {
  id: string;
  conversationId: string;
  workflowRunId?: string | null;
  workflowName?: string;
  modelId: string;
  requestMessageId: string;
  responseMessageId?: string | null;
}): Promise<WorkflowChatRun> {
  const db = getDb();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO workflowchat_runs (id, conversation_id, workflow_run_id, workflow_name, model_id, request_message_id, response_message_id, status, error_json, started_at, finished_at, total_duration_ms, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?, ?)`,
    args: [
      params.id,
      params.conversationId,
      params.workflowRunId ?? null,
      params.workflowName ?? 'workflowchatReplyWorkflow',
      params.modelId,
      params.requestMessageId,
      params.responseMessageId ?? null,
      now,
      now,
    ],
  });

  return {
    id: params.id,
    conversation_id: params.conversationId,
    workflow_run_id: params.workflowRunId ?? null,
    workflow_name: params.workflowName ?? 'workflowchatReplyWorkflow',
    model_id: params.modelId,
    request_message_id: params.requestMessageId,
    response_message_id: params.responseMessageId ?? null,
    status: 'pending',
    error_json: null,
    started_at: null,
    finished_at: null,
    total_duration_ms: null,
    created_at: now,
    updated_at: now,
  };
}

export async function getWfChatRun(id: string): Promise<WorkflowChatRun | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_runs WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToWfChatRun(result.rows[0] as Record<string, unknown>);
}

export async function getWfChatRunsByConversationId(conversationId: string): Promise<WorkflowChatRun[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_runs WHERE conversation_id = ? ORDER BY created_at DESC',
    args: [conversationId],
  });
  return result.rows.map(row => rowToWfChatRun(row as Record<string, unknown>));
}

export async function getWfChatRunByWorkflowRunId(workflowRunId: string): Promise<WorkflowChatRun | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_runs WHERE workflow_run_id = ?',
    args: [workflowRunId],
  });
  if (result.rows.length === 0) return null;
  return rowToWfChatRun(result.rows[0] as Record<string, unknown>);
}

export async function updateWfChatRun(
  id: string,
  data: {
    workflowRunId?: string | null;
    responseMessageId?: string | null;
    status?: WorkflowChatRunStatus;
    errorJson?: string | null;
    startedAt?: number | null;
    finishedAt?: number | null;
    totalDurationMs?: number | null;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }
): Promise<WorkflowChatRun | null> {
  const db = getDb();
  const now = Date.now();
  const updates: string[] = ['updated_at = ?'];
  const args: (string | number | null)[] = [now];

  if (data.workflowRunId !== undefined) {
    updates.push('workflow_run_id = ?');
    args.push(data.workflowRunId);
  }
  if (data.responseMessageId !== undefined) {
    updates.push('response_message_id = ?');
    args.push(data.responseMessageId);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    args.push(data.status);
  }
  if (data.errorJson !== undefined) {
    updates.push('error_json = ?');
    args.push(data.errorJson);
  }
  if (data.startedAt !== undefined) {
    updates.push('started_at = ?');
    args.push(data.startedAt);
  }
  if (data.finishedAt !== undefined) {
    updates.push('finished_at = ?');
    args.push(data.finishedAt);
  }
  if (data.totalDurationMs !== undefined) {
    updates.push('total_duration_ms = ?');
    args.push(data.totalDurationMs);
  }
  if (data.promptTokens !== undefined) {
    updates.push('prompt_tokens = ?');
    args.push(data.promptTokens);
  }
  if (data.completionTokens !== undefined) {
    updates.push('completion_tokens = ?');
    args.push(data.completionTokens);
  }
  if (data.totalTokens !== undefined) {
    updates.push('total_tokens = ?');
    args.push(data.totalTokens);
  }

  args.push(id);

  const result = await db.execute({
    sql: `UPDATE workflowchat_runs SET ${updates.join(', ')} WHERE id = ?`,
    args,
  });

  if (result.rowsAffected === 0) return null;
  return getWfChatRun(id);
}

// ==================== Run Steps CRUD ====================

export async function createWfChatRunStep(params: {
  id: string;
  workflowRunId: string;
  stepNumber: number;
  stepName: string;
}): Promise<WorkflowChatRunStep> {
  const db = getDb();
  const now = Date.now();

  // 使用 INSERT OR IGNORE 支持 step 重试幂等
  await db.execute({
    sql: `INSERT OR IGNORE INTO workflowchat_run_steps (id, workflow_run_id, step_number, step_name, status, started_at, finished_at, duration_ms, finish_reason, created_at)
          VALUES (?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?)`,
    args: [params.id, params.workflowRunId, params.stepNumber, params.stepName, now],
  });

  return {
    id: params.id,
    workflow_run_id: params.workflowRunId,
    step_number: params.stepNumber,
    step_name: params.stepName,
    status: 'pending',
    started_at: null,
    finished_at: null,
    duration_ms: null,
    finish_reason: null,
    created_at: now,
  };
}

export async function getWfChatRunStepsByWorkflowRunId(workflowRunId: string): Promise<WorkflowChatRunStep[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_run_steps WHERE workflow_run_id = ? ORDER BY step_number ASC',
    args: [workflowRunId],
  });
  return result.rows.map(row => rowToWfChatRunStep(row as Record<string, unknown>));
}

export async function updateWfChatRunStep(
  id: string,
  data: {
    status?: WorkflowChatStepStatus;
    startedAt?: number | null;
    finishedAt?: number | null;
    durationMs?: number | null;
    finishReason?: string | null;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }
): Promise<WorkflowChatRunStep | null> {
  const db = getDb();
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.status !== undefined) {
    updates.push('status = ?');
    args.push(data.status);
  }
  if (data.startedAt !== undefined) {
    updates.push('started_at = ?');
    args.push(data.startedAt);
  }
  if (data.finishedAt !== undefined) {
    updates.push('finished_at = ?');
    args.push(data.finishedAt);
  }
  if (data.durationMs !== undefined) {
    updates.push('duration_ms = ?');
    args.push(data.durationMs);
  }
  if (data.finishReason !== undefined) {
    updates.push('finish_reason = ?');
    args.push(data.finishReason);
  }
  if (data.promptTokens !== undefined) {
    updates.push('prompt_tokens = ?');
    args.push(data.promptTokens);
  }
  if (data.completionTokens !== undefined) {
    updates.push('completion_tokens = ?');
    args.push(data.completionTokens);
  }
  if (data.totalTokens !== undefined) {
    updates.push('total_tokens = ?');
    args.push(data.totalTokens);
  }

  if (updates.length === 0) return getWfChatRunStep(id);

  args.push(id);

  const result = await db.execute({
    sql: `UPDATE workflowchat_run_steps SET ${updates.join(', ')} WHERE id = ?`,
    args,
  });

  if (result.rowsAffected === 0) return null;
  return getWfChatRunStep(id);
}

export async function getWfChatRunStep(id: string): Promise<WorkflowChatRunStep | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM workflowchat_run_steps WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToWfChatRunStep(result.rows[0] as Record<string, unknown>);
}