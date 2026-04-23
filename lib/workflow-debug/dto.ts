/**
 * 调试页 DTO 类型定义
 * 定义调试 API 返回的数据结构，将业务库和 World SDK 的原始数据转换为前端友好的格式
 */

import type { WorkflowChatRunStatus } from '@/lib/schemas/workflowchat';

// ==================== 分页类型 ====================

/** 分页游标信息 */
export interface PaginationInfo {
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 下一页游标，null 表示没有下一页 */
  nextCursor: string | null;
}

// ==================== Run 列表 DTO ====================

/** 调试页 Run 列表项 — 轻量级，不含 hydrated input/output */
export interface DebugRunListItemDTO {
  id: string;
  conversationId: string;
  workflowRunId: string | null;
  workflowName: string;
  modelId: string;
  status: WorkflowChatRunStatus;
  errorJson: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  totalDurationMs: number | null;
  createdAt: number;
}

/** Run 列表查询筛选参数 */
export interface DebugRunListFilters {
  /** 按状态筛选 */
  status?: WorkflowChatRunStatus;
  /** 按会话 ID 筛选 */
  conversationId?: string;
  /** 分页游标 */
  cursor?: string;
  /** 每页数量，默认 20 */
  limit?: number;
}

/** Run 列表响应 */
export interface DebugRunListResponse {
  runs: DebugRunListItemDTO[];
  pagination: PaginationInfo;
}

// ==================== Run 详情 DTO ====================

/** hydrated 的消息摘要 — 用于调试页展示请求/响应映射 */
export interface DebugHydratedMessageDTO {
  /** 消息 id */
  id: string;
  /** 角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容摘要（截断后的纯文本） */
  contentPreview: string;
  /** 完整消息内容长度 */
  contentLength: number;
}

/** hydrated 的 input/output 摘要 */
export interface DebugHydratedDataDTO {
  /** 原始序列化数据 */
  raw: unknown;
  /** 数据类型的简要描述 */
  typeHint: string;
  /** 数据大小（字节） */
  size: number;
}

/** Debug Step DTO — 从 World SDK step 转换 */
export interface DebugStepDTO {
  /** step id（来自 World SDK） */
  stepId: string;
  stepName: string;
  status: string;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  finishReason: string | null;
  /** hydrated input 摘要 */
  inputSummary: DebugHydratedDataDTO | null;
  /** hydrated output 摘要 */
  outputSummary: DebugHydratedDataDTO | null;
  /** hydrated error 摘要 */
  errorSummary: { message: string; code?: string } | null;
}

/** Run 详情响应 — 业务库数据 + World SDK hydration */
export interface DebugRunDetailDTO {
  /** 业务库 run 基础信息 */
  id: string;
  conversationId: string;
  workflowRunId: string | null;
  workflowName: string;
  modelId: string;
  status: WorkflowChatRunStatus;
  errorJson: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  totalDurationMs: number | null;
  createdAt: number;
  updatedAt: number;

  /** 业务库 request message 映射 */
  requestMessage: DebugHydratedMessageDTO | null;
  /** 业务库 response message 映射 */
  responseMessage: DebugHydratedMessageDTO | null;

  /** World SDK hydrated input 摘要 */
  hydratedInput: DebugHydratedDataDTO | null;
  /** World SDK hydrated output 摘要 */
  hydratedOutput: DebugHydratedDataDTO | null;

  /** 业务库 step 时间线 */
  steps: DebugStepDTO[];

  /** World SDK run 状态（如有） */
  worldStatus: string | null;
  /** World SDK run 错误信息（如有） */
  worldError: { message: string; code?: string } | null;
}

// ==================== Events DTO ====================

/** Debug Event DTO — 从 World SDK event 转换 */
export interface DebugEventDTO {
  /** 事件 id */
  eventId: string;
  /** 关联的 run id */
  runId: string;
  /** 事件类型 */
  eventType: string;
  /** 事件数据摘要 */
  eventData: unknown;
  /** 关联 id */
  correlationId: string | null;
  /** 创建时间 */
  createdAt: string;
}

/** Events 列表响应 */
export interface DebugEventListResponse {
  events: DebugEventDTO[];
  pagination: PaginationInfo;
}

// ==================== Stream DTO ====================

/** Stream 单个 chunk */
export interface DebugStreamChunkDTO {
  /** chunk 索引（0-based） */
  index: number;
  /** chunk 文本内容（尝试 UTF-8 解码） */
  content: string;
  /** 是否为二进制数据 */
  isBinary: boolean;
}

/** Stream 详情/内容响应 */
export interface DebugStreamDTO {
  /** stream 名称 */
  streamName: string;
  /** stream 所属 run id */
  runId: string;
  /** 是否已完成（已关闭） */
  done: boolean;
  /** stream 尾部索引 */
  tailIndex: number;
  /** chunk 列表 */
  chunks: DebugStreamChunkDTO[];
  /** 分页信息 */
  pagination: PaginationInfo;
}