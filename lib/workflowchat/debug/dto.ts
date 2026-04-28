/**
 * 调试页 DTO 类型定义
 */

import type { WorkflowChatRunStatus } from '@/lib/schemas/workflowchat';

// ==================== 分页类型 ====================

export interface PaginationInfo {
  hasMore: boolean;
  nextCursor: string | null;
}

// ==================== Run 列表 DTO ====================

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

export interface DebugRunListFilters {
  status?: WorkflowChatRunStatus;
  conversationId?: string;
  cursor?: string;
  limit?: number;
}

export interface DebugRunListResponse {
  runs: DebugRunListItemDTO[];
  pagination: PaginationInfo;
}

// ==================== Run 详情 DTO ====================

export interface DebugHydratedMessageDTO {
  id: string;
  role: 'user' | 'assistant' | 'system';
  contentPreview: string;
  contentLength: number;
}

export interface DebugHydratedDataDTO {
  raw: unknown;
  typeHint: string;
  size: number;
}

export interface DebugStepDTO {
  stepId: string;
  stepName: string;
  status: string;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  finishReason: string | null;
  inputSummary: DebugHydratedDataDTO | null;
  outputSummary: DebugHydratedDataDTO | null;
  errorSummary: { message: string; code?: string } | null;
}

export interface DebugRunDetailDTO {
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
  requestMessage: DebugHydratedMessageDTO | null;
  responseMessage: DebugHydratedMessageDTO | null;
  hydratedInput: DebugHydratedDataDTO | null;
  hydratedOutput: DebugHydratedDataDTO | null;
  steps: DebugStepDTO[];
  worldStatus: string | null;
  worldError: { message: string; code?: string } | null;
}

// ==================== Events DTO ====================

export interface DebugEventDTO {
  eventId: string;
  runId: string;
  eventType: string;
  eventData: unknown;
  correlationId: string | null;
  createdAt: string;
}

export interface DebugEventListResponse {
  events: DebugEventDTO[];
  pagination: PaginationInfo;
}

// ==================== Stream DTO ====================

export interface DebugStreamChunkDTO {
  index: number;
  content: string;
  isBinary: boolean;
}

export interface DebugStreamDTO {
  streamName: string;
  runId: string;
  done: boolean;
  tailIndex: number;
  chunks: DebugStreamChunkDTO[];
  pagination: PaginationInfo;
}