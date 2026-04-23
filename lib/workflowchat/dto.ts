/**
 * WorkflowChat DTO 类型定义
 * 包含请求/响应 DTO、Workflow 输入参数类型等
 */

import type { UIMessage } from 'ai';
import type { StepTiming } from './constants';
import type {
  WorkflowChatConversationStatus,
  WorkflowChatRunStatus,
  WorkflowChatStepStatus,
} from '@/lib/schemas/workflowchat';

// ==================== 响应 DTO ====================

/** 会话 DTO — 列表/详情接口返回 */
export interface ConversationDTO {
  id: string;
  userId: string | null;
  title: string | null;
  status: WorkflowChatConversationStatus;
  activeStreamId: string | null;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
}

/** 消息 DTO — 消息接口返回 */
export interface MessageDTO {
  id: string;
  conversationId: string;
  runId: string | null;
  role: 'user' | 'assistant' | 'system';
  parts: string;
  createdAt: number;
}

/** Run DTO — run 状态接口返回 */
export interface RunDTO {
  id: string;
  conversationId: string;
  workflowRunId: string | null;
  workflowName: string;
  modelId: string;
  requestMessageId: string;
  responseMessageId: string | null;
  status: WorkflowChatRunStatus;
  errorJson: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  totalDurationMs: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Run Step DTO — run step 详情返回 */
export interface RunStepDTO {
  id: string;
  workflowRunId: string;
  stepNumber: number;
  stepName: string;
  status: WorkflowChatStepStatus;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  finishReason: string | null;
  createdAt: number;
}

/** 会话详情响应 — 含消息历史和活跃 stream id */
export interface ConversationDetailDTO {
  conversation: ConversationDTO;
  messages: MessageDTO[];
  activeStreamId: string | null;
}

// ==================== 请求 DTO ====================

/** 创建会话请求 */
export interface CreateConversationRequest {
  /** 可选标题 */
  title?: string;
}

/** 发送消息请求 */
export interface SendMessageRequest {
  /** 用户消息内容（AI SDK UIMessage 格式） */
  message: UIMessage;
  /** 可选模型 id，覆盖默认模型 */
  modelId?: string;
}

// ==================== Workflow 输入参数类型 ====================

/** 主回复 Workflow 输入参数 */
export interface WorkflowChatRunInput {
  /** 会话 id */
  conversationId: string;
  /** 业务 run id（workflowchat_runs.id） */
  runId: string;
  /** 请求消息 id */
  requestMessageId: string;
  /** 用户 id，首版不强制登录，可为 null */
  userId: string | null;
  /** 模型 id */
  modelId: string;
  /** 消息历史（AI SDK UIMessage 格式，传递给 ToolLoopAgent） */
  messages: UIMessage[];
}

/** Post-finish Workflow 输入参数 */
export interface PostFinishInput {
  /** 会话 id */
  conversationId: string;
  /** 业务 run id */
  runId: string;
  /** World 侧 workflow run id */
  workflowRunId: string;
  /** 请求消息 id */
  requestMessageId: string;
  /** 响应消息，主 workflow 失败时为 null */
  responseMessage: UIMessage | null;
  /** 完成原因："completed" / "failed" */
  finishReason: string;
  /** 失败时有值，仅保留可序列化的 message 和 stack */
  error: string | null;
  /** 用户 id */
  userId: string | null;
  /** 模型 id */
  modelId: string;
  /** step 耗时数据，批量写入 */
  stepTimings: StepTiming[];
}