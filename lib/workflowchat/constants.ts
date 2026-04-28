/**
 * WorkflowChat 常量定义
 * 包含 workflow 名称、状态枚举、StepTiming 类型等
 */

import type {
  WorkflowChatConversationStatus,
  WorkflowChatRunStatus,
  WorkflowChatStepStatus,
} from '@/lib/schemas/workflowchat';

// ==================== Workflow 名称 ====================

/** 主回复 workflow 名称 */
export const WORKFLOWCHAT_REPLY_WORKFLOW_NAME = 'workflowchatReplyWorkflow';

/** Post-finish 后处理 workflow 名称 */
export const WORKFLOWCHAT_POST_FINISH_WORKFLOW_NAME = 'workflowchatPostFinishWorkflow';

// ==================== 状态枚举常量 ====================

/** 会话状态枚举值 */
export const WORKFLOWCHAT_CONVERSATION_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const satisfies Record<string, WorkflowChatConversationStatus>;

/** Run 状态枚举值 */
export const WORKFLOWCHAT_RUN_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const satisfies Record<string, WorkflowChatRunStatus>;

/** Step 状态枚举值 */
export const WORKFLOWCHAT_STEP_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const satisfies Record<string, WorkflowChatStepStatus>;

// ==================== StepTiming 类型 ====================

/** Step 执行耗时记录 */
export interface StepTiming {
  /** 业务 run id（workflowchat_runs.id） */
  runId: string;
  /** step 序号 */
  stepNumber: number;
  /** step 名称 */
  stepName: string;
  /** 开始时间戳（ms） */
  startedAt: number | null;
  /** 结束时间戳（ms） */
  finishedAt: number | null;
  /** 耗时（ms） */
  durationMs: number | null;
  /** 完成原因 */
  finishReason: string | null;
  /** Prompt token 数量 */
  promptTokens?: number;
  /** Completion token 数量 */
  completionTokens?: number;
  /** 总 token 数量 */
  totalTokens?: number;
}