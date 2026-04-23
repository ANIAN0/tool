/**
 * 调试服务层
 * 整合业务库数据和 World SDK 数据，提供调试页所需的所有查询功能
 */

import { getDb } from '@/lib/db/client';
import type {
  WorkflowChatRun,
  WorkflowChatMessage,
  WorkflowChatRunStatus,
  WorkflowChatConversationStatus,
  WorkflowChatStepStatus,
} from '@/lib/schemas/workflowchat';
import { WORKFLOWCHAT_RUN_STATUS } from '@/lib/workflowchat/constants';
import { getDebugWorld } from './world';
import {
  hydrateRunData,
  hydrateWorldStep,
  hydrateWorldEvent,
  hydrateStreamChunk,
  truncateContent,
} from './hydrate';
import type {
  DebugRunListItemDTO,
  DebugRunDetailDTO,
  DebugRunListFilters,
  DebugRunListResponse,
  DebugHydratedMessageDTO,
  DebugHydratedDataDTO,
  DebugStepDTO,
  DebugEventDTO,
  DebugEventListResponse,
  DebugStreamDTO,
  DebugStreamChunkDTO,
  PaginationInfo,
} from './dto';
import type { WorkflowChatRunStep } from '@/lib/schemas/workflowchat';

// ==================== Row 转换函数 ====================

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
    created_at: row.created_at as number,
  };
}

// ==================== Run → DTO 转换 ====================

function runToListItemDTO(run: WorkflowChatRun): DebugRunListItemDTO {
  return {
    id: run.id,
    conversationId: run.conversation_id,
    workflowRunId: run.workflow_run_id,
    workflowName: run.workflow_name,
    modelId: run.model_id,
    status: run.status,
    errorJson: run.error_json,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    totalDurationMs: run.total_duration_ms,
    createdAt: run.created_at,
  };
}

// ==================== 游标编解码 ====================

/** 游标编码 — 使用 base64 编码创建时间戳 + id，用于分页 */
function encodeCursor(createdAt: number, id: string): string {
  return Buffer.from(`${createdAt}:${id}`).toString('base64url');
}

/** 游标解码 */
function decodeCursor(cursor: string): { createdAt: number; id: string } {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`无效的游标格式: ${cursor}`);
  }
  return {
    createdAt: parseInt(decoded.slice(0, colonIndex), 10),
    id: decoded.slice(colonIndex + 1),
  };
}

// ==================== 服务函数 ====================

/**
 * 查询调试 run 列表
 * 支持按状态、会话 ID 筛选和游标分页
 *
 * 数据源：仅业务库（workflowchat_runs），不需要 World SDK
 */
export async function listDebugRuns(filters: DebugRunListFilters = {}): Promise<DebugRunListResponse> {
  const { status, conversationId, cursor, limit = 20 } = filters;
  const db = getDb();

  // 构建查询条件和参数
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (status) {
    conditions.push('status = ?');
    args.push(status);
  }
  if (conversationId) {
    conditions.push('conversation_id = ?');
    args.push(conversationId);
  }

  // 游标分页：结合 created_at 和 id 确保稳定排序
  if (cursor) {
    const { createdAt, id } = decodeCursor(cursor);
    conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
    args.push(createdAt, createdAt, id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 多查一条以判断是否有更多数据
  const sql = `SELECT * FROM workflowchat_runs ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ?`;
  args.push(limit + 1);

  const result = await db.execute({ sql, args });

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

  const runs = rows.map(row => rowToWfChatRun(row as Record<string, unknown>));
  const runDTOs = runs.map(runToListItemDTO);

  // 生成分页游标
  let nextCursor: string | null = null;
  if (hasMore && runs.length > 0) {
    const lastRun = runs[runs.length - 1];
    nextCursor = encodeCursor(lastRun.created_at, lastRun.id);
  }

  return {
    runs: runDTOs,
    pagination: {
      hasMore,
      nextCursor,
    },
  };
}

/**
 * 获取调试 run 详情
 * 整合业务库数据和 World SDK hydration 数据
 *
 * 数据源：业务库（run + steps + messages）+ World SDK（run 详情 + hydrated data）
 *
 * @param runIdOrWorkflowRunId 支持传入业务库 run id 或 workflow_run_id
 */
export async function getDebugRunDetail(runIdOrWorkflowRunId: string): Promise<DebugRunDetailDTO | null> {
  const db = getDb();

  // 1. 从业务库查询 run 记录 — 先按 id 查，再按 workflow_run_id 查
  let runResult = await db.execute({
    sql: 'SELECT * FROM workflowchat_runs WHERE id = ?',
    args: [runIdOrWorkflowRunId],
  });
  if (runResult.rows.length === 0) {
    runResult = await db.execute({
      sql: 'SELECT * FROM workflowchat_runs WHERE workflow_run_id = ?',
      args: [runIdOrWorkflowRunId],
    });
  }
  if (runResult.rows.length === 0) return null;

  const run = rowToWfChatRun(runResult.rows[0] as Record<string, unknown>);
  const { workflow_run_id } = run;

  // 2. 从业务库查询 step 时间线（pending 状态无 workflow_run_id，跳过）
  let dbSteps: WorkflowChatRunStep[] = [];
  if (workflow_run_id) {
    const stepsResult = await db.execute({
      sql: 'SELECT * FROM workflowchat_run_steps WHERE workflow_run_id = ? ORDER BY step_number ASC',
      args: [workflow_run_id],
    });
    dbSteps = stepsResult.rows.map(row => rowToWfChatRunStep(row as Record<string, unknown>));
  }

  // 3. 查询请求和响应消息
  let requestMessage: DebugHydratedMessageDTO | null = null;
  let responseMessage: DebugHydratedMessageDTO | null = null;

  if (run.request_message_id) {
    const msgResult = await db.execute({
      sql: 'SELECT * FROM workflowchat_messages WHERE id = ?',
      args: [run.request_message_id],
    });
    if (msgResult.rows.length > 0) {
      const msg = msgResult.rows[0] as Record<string, unknown>;
      requestMessage = hydrateMessageDTO(msg);
    }
  }

  if (run.response_message_id) {
    const msgResult = await db.execute({
      sql: 'SELECT * FROM workflowchat_messages WHERE id = ?',
      args: [run.response_message_id],
    });
    if (msgResult.rows.length > 0) {
      const msg = msgResult.rows[0] as Record<string, unknown>;
      responseMessage = hydrateMessageDTO(msg);
    }
  }

  // 4. 尝试从 World SDK 获取 hydrated 数据（pending 状态无 workflow_run_id，跳过）
  let hydratedInput: DebugHydratedDataDTO | null = null;
  let hydratedOutput: DebugHydratedDataDTO | null = null;
  let worldStepDTOs: DebugStepDTO[] = [];
  let worldStatus: string | null = null;
  let worldError: { message: string; code?: string } | null = null;

  if (workflow_run_id) {
    try {
      const world = getDebugWorld();
      const worldRun = await world.runs.get(workflow_run_id, { resolveData: 'all' });

      // World SDK run 状态和错误
      worldStatus = worldRun.status;
      if (worldRun.status === 'failed' && 'error' in worldRun && worldRun.error) {
        worldError = { message: worldRun.error.message, code: worldRun.error.code };
      }

      // hydrated input/output
      hydratedInput = hydrateRunData(worldRun.input);
      if ('output' in worldRun && worldRun.output !== undefined) {
        hydratedOutput = hydrateRunData(worldRun.output);
      }

      // 从 World SDK 获取 steps（含 hydrated 数据）
      const worldStepsResult = await world.steps.list({
        runId: workflow_run_id,
        resolveData: 'all',
      });

      // 构建 World SDK step 的 stepName → stepId 映射，用于合并业务库 step
      const worldStepMap = new Map<string, DebugStepDTO>();
      for (const worldStep of worldStepsResult.data) {
        worldStepMap.set(worldStep.stepName, hydrateWorldStep(worldStep));
      }

      // 合并业务库 step 时间信息和 World SDK hydrated 数据
      worldStepDTOs = dbSteps.map(dbStep => {
        const worldStep = worldStepMap.get(dbStep.step_name);
        if (worldStep) {
          // 优先使用业务库的时间信息，补充 World SDK 的 hydrated 数据
          return {
            ...worldStep,
            durationMs: dbStep.duration_ms ?? worldStep.durationMs,
            finishReason: dbStep.finish_reason ?? worldStep.finishReason,
          };
        }
        return dbStepToStepDTO(dbStep);
      });
    } catch {
      // World SDK 不可用（run 不存在或 SDK 未配置），返回业务库数据
      worldStepDTOs = dbSteps.map(dbStepToStepDTO);
    }
  }

  return {
    id: run.id,
    conversationId: run.conversation_id,
    workflowRunId: run.workflow_run_id,
    workflowName: run.workflow_name,
    modelId: run.model_id,
    status: run.status,
    errorJson: run.error_json,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    totalDurationMs: run.total_duration_ms,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    requestMessage,
    responseMessage,
    hydratedInput,
    hydratedOutput,
    steps: worldStepDTOs,
    worldStatus,
    worldError,
  };
}

/**
 * 获取调试 run 的 events 列表
 * 数据源：World SDK
 */
export async function getDebugRunEvents(
  workflowRunId: string,
  options?: { cursor?: string; limit?: number },
): Promise<DebugEventListResponse> {
  const world = getDebugWorld();

  const pagination = {
    limit: options?.limit ?? 50,
    cursor: options?.cursor,
  };

  const result = await world.events.list({
    runId: workflowRunId,
    pagination,
    resolveData: 'all',
  });

  const events = result.data.map(hydrateWorldEvent);

  return {
    events,
    pagination: {
      hasMore: result.hasMore,
      nextCursor: result.cursor,
    },
  };
}

/**
 * 获取调试 run 的 stream 内容
 * 数据源：World SDK
 */
export async function getDebugRunStream(
  workflowRunId: string,
  streamName: string,
  options?: { cursor?: string; limit?: number },
): Promise<DebugStreamDTO> {
  const world = getDebugWorld();

  // 先获取 stream 元信息
  const streamInfo = await world.getStreamInfo(streamName, workflowRunId);

  // 获取 stream chunk 数据
  const chunksResult = await world.getStreamChunks(streamName, workflowRunId, {
    limit: options?.limit ?? 100,
    cursor: options?.cursor,
  });

  const chunkDTOs: DebugStreamChunkDTO[] = chunksResult.data.map(chunk =>
    hydrateStreamChunk(chunk.data, chunk.index),
  );

  return {
    streamName,
    runId: workflowRunId,
    done: chunksResult.done,
    tailIndex: streamInfo.tailIndex,
    chunks: chunkDTOs,
    pagination: {
      hasMore: chunksResult.hasMore,
      nextCursor: chunksResult.cursor,
    },
  };
}

// ==================== 内部辅助函数 ====================

/** 将业务库消息行转换为 DebugHydratedMessageDTO */
function hydrateMessageDTO(row: Record<string, unknown>): DebugHydratedMessageDTO {
  const parts = row.parts as string;
  let contentPreview: string;
  let contentLength: number;

  try {
    // 尝试解析 AI SDK UIMessage parts 格式
    const parsed = JSON.parse(parts);
    if (Array.isArray(parsed)) {
      // 提取文本内容用于预览
      const textParts = parsed
        .filter((p: { type: string }) => p.type === 'text')
        .map((p: { text: string }) => p.text);
      const fullText = textParts.join('\n');
      contentPreview = truncateContent(fullText);
      contentLength = fullText.length;
    } else {
      const str = JSON.stringify(parsed);
      contentPreview = truncateContent(str);
      contentLength = str.length;
    }
  } catch {
    // 非 JSON，直接使用原始内容
    contentPreview = truncateContent(parts);
    contentLength = parts.length;
  }

  return {
    id: row.id as string,
    role: row.role as 'user' | 'assistant' | 'system',
    contentPreview,
    contentLength,
  };
}

/** 将业务库 step 转换为 DebugStepDTO（不含 hydrated 数据） */
function dbStepToStepDTO(step: WorkflowChatRunStep): DebugStepDTO {
  let finishReason: string | null = null;
  if (step.status === 'completed') {
    finishReason = 'completed';
  } else if (step.status === 'failed') {
    finishReason = 'failed';
  }

  return {
    stepId: step.id,
    stepName: step.step_name,
    status: step.status,
    attempt: 1, // 业务库不记录 attempt，默认 1
    startedAt: step.started_at ? new Date(step.started_at).toISOString() : null,
    completedAt: step.finished_at ? new Date(step.finished_at).toISOString() : null,
    durationMs: step.duration_ms,
    finishReason: step.finish_reason ?? finishReason,
    inputSummary: null,
    outputSummary: null,
    errorSummary: null,
  };
}