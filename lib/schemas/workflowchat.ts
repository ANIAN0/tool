/**
 * WorkflowChat 表结构定义
 * 独立于 conversations/messages，支持 workflow 驱动的对话模式
 */

// ==================== 表结构定义 ====================

/**
 * workflowchat_conversations表 - WorkflowChat会话
 * 独立于 conversations 表，用于 workflow 驱动的对话场景
 * active_stream_id: 当前活跃的 workflow runId，用于 CAS 抢占
 * agent_id: 关联的 Agent ID，必填字段，会话创建时绑定
 */
export const CREATE_WORKFLOWCHAT_CONVERSATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS workflowchat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  agent_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  active_stream_id TEXT,
  last_message_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * workflowchat_messages表 - WorkflowChat消息
 * parts 字段存储 AI SDK UIMessage parts 格式（JSON）
 */
export const CREATE_WORKFLOWCHAT_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS workflowchat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  run_id TEXT,
  role TEXT NOT NULL,
  parts TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES workflowchat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES workflowchat_runs(id) ON DELETE SET NULL
);
`;

/**
 * workflowchat_runs表 - WorkflowChat业务Run
 * 记录每一轮 workflow 执行的完整生命周期
 * workflow_run_id: World 侧的 runId，非空时唯一
 * token 统计字段：prompt_tokens、completion_tokens、total_tokens
 */
export const CREATE_WORKFLOWCHAT_RUNS_TABLE = `
CREATE TABLE IF NOT EXISTS workflowchat_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  workflow_run_id TEXT,
  workflow_name TEXT NOT NULL DEFAULT 'workflowchatReplyWorkflow',
  model_id TEXT NOT NULL,
  request_message_id TEXT NOT NULL,
  response_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_json TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  total_duration_ms INTEGER,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES workflowchat_conversations(id) ON DELETE CASCADE
);
`;

/**
 * workflowchat_run_steps表 - WorkflowChat Run Step
 * 记录 workflow run 中每个 step 的执行详情
 */
export const CREATE_WORKFLOWCHAT_RUN_STEPS_TABLE = `
CREATE TABLE IF NOT EXISTS workflowchat_run_steps (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at INTEGER,
  finished_at INTEGER,
  duration_ms INTEGER,
  finish_reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES workflowchat_runs(id) ON DELETE CASCADE
);
`;

// ==================== 索引定义 ====================

/**
 * workflowchat_conversations 相关索引
 */
export const CREATE_WORKFLOWCHAT_CONVERSATION_INDEXES = [
  // 会话列表按更新时间降序排序
  `CREATE INDEX IF NOT EXISTS idx_wfchat_conv_updated_at ON workflowchat_conversations(updated_at DESC);`,
  // 按用户ID查询会话
  `CREATE INDEX IF NOT EXISTS idx_wfchat_conv_user_id ON workflowchat_conversations(user_id);`,
  // 按AgentID查询会话
  `CREATE INDEX IF NOT EXISTS idx_wfchat_conv_agent_id ON workflowchat_conversations(agent_id);`,
];

/**
 * workflowchat_messages 相关索引
 */
export const CREATE_WORKFLOWCHAT_MESSAGE_INDEXES = [
  // 按会话+创建时间排序消息
  `CREATE INDEX IF NOT EXISTS idx_wfchat_msg_conv_created ON workflowchat_messages(conversation_id, created_at ASC);`,
  // 按 run_id 查询消息
  `CREATE INDEX IF NOT EXISTS idx_wfchat_msg_run_id ON workflowchat_messages(run_id);`,
];

/**
 * workflowchat_runs 相关索引
 */
export const CREATE_WORKFLOWCHAT_RUN_INDEXES = [
  // 按会话+创建时间降序查询 run
  `CREATE INDEX IF NOT EXISTS idx_wfchat_run_conv_created ON workflowchat_runs(conversation_id, created_at DESC);`,
  // workflow_run_id 唯一索引（仅非空时生效）
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_wfchat_run_workflow_run_id ON workflowchat_runs(workflow_run_id) WHERE workflow_run_id IS NOT NULL;`,
  // 按会话+状态查询 run
  `CREATE INDEX IF NOT EXISTS idx_wfchat_run_conv_status ON workflowchat_runs(conversation_id, status);`,
];

/**
 * workflowchat_run_steps 相关索引
 */
export const CREATE_WORKFLOWCHAT_RUN_STEP_INDEXES = [
  // 按 run+step序号 唯一索引
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_wfchat_step_run_number ON workflowchat_run_steps(workflow_run_id, step_number ASC);`,
];

/**
 * 所有 WorkflowChat 索引汇总
 */
export const CREATE_WORKFLOWCHAT_INDEXES = [
  ...CREATE_WORKFLOWCHAT_CONVERSATION_INDEXES,
  ...CREATE_WORKFLOWCHAT_MESSAGE_INDEXES,
  ...CREATE_WORKFLOWCHAT_RUN_INDEXES,
  ...CREATE_WORKFLOWCHAT_RUN_STEP_INDEXES,
];

// ==================== 类型定义 ====================

/**
 * WorkflowChat 会话状态
 */
export type WorkflowChatConversationStatus = 'active' | 'archived';

/**
 * WorkflowChat Run 状态
 */
export type WorkflowChatRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * WorkflowChat Step 状态
 */
export type WorkflowChatStepStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * WorkflowChat 会话类型
 */
export interface WorkflowChatConversation {
  id: string;
  user_id: string | null;
  agent_id: string;
  title: string | null;
  status: WorkflowChatConversationStatus;
  active_stream_id: string | null;
  last_message_at: number;
  created_at: number;
  updated_at: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

/**
 * WorkflowChat 消息类型
 */
export interface WorkflowChatMessage {
  id: string;
  conversation_id: string;
  run_id: string | null;
  role: 'user' | 'assistant' | 'system';
  parts: string;
  created_at: number;
}

/**
 * WorkflowChat Run 类型
 */
export interface WorkflowChatRun {
  id: string;
  conversation_id: string;
  workflow_run_id: string | null;
  workflow_name: string;
  model_id: string;
  request_message_id: string;
  response_message_id: string | null;
  status: WorkflowChatRunStatus;
  error_json: string | null;
  started_at: number | null;
  finished_at: number | null;
  total_duration_ms: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  created_at: number;
  updated_at: number;
}

/**
 * WorkflowChat Run Step 类型
 */
export interface WorkflowChatRunStep {
  id: string;
  workflow_run_id: string;
  step_number: number;
  step_name: string;
  status: WorkflowChatStepStatus;
  started_at: number | null;
  finished_at: number | null;
  duration_ms: number | null;
  finish_reason: string | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  created_at: number;
}

// ==================== 迁移定义 ====================

/**
 * 迁移：为 workflowchat_conversations 表添加 agent_id 字段
 */
export const MIGRATION_WORKFLOWCHAT_ADD_AGENT_ID = `
ALTER TABLE workflowchat_conversations ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'default'
`;

/**
 * 迁移：为 workflowchat_runs 表添加 token 统计字段
 */
export const MIGRATION_WORKFLOWCHAT_ADD_RUN_TOKEN_FIELDS = `
ALTER TABLE workflowchat_runs ADD COLUMN prompt_tokens INTEGER DEFAULT 0;
ALTER TABLE workflowchat_runs ADD COLUMN completion_tokens INTEGER DEFAULT 0;
ALTER TABLE workflowchat_runs ADD COLUMN total_tokens INTEGER DEFAULT 0;
`;

/**
 * 迁移：为 workflowchat_run_steps 表添加 token 统计字段
 */
export const MIGRATION_WORKFLOWCHAT_ADD_STEP_TOKEN_FIELDS = `
ALTER TABLE workflowchat_run_steps ADD COLUMN prompt_tokens INTEGER DEFAULT 0;
ALTER TABLE workflowchat_run_steps ADD COLUMN completion_tokens INTEGER DEFAULT 0;
ALTER TABLE workflowchat_run_steps ADD COLUMN total_tokens INTEGER DEFAULT 0;
`;

/**
 * 迁移：为 workflowchat_conversations 表添加 token 累计字段
 */
export const MIGRATION_WORKFLOWCHAT_ADD_CONVERSATION_TOKEN_FIELDS = `
ALTER TABLE workflowchat_conversations ADD COLUMN total_input_tokens INTEGER DEFAULT 0;
ALTER TABLE workflowchat_conversations ADD COLUMN total_output_tokens INTEGER DEFAULT 0;
ALTER TABLE workflowchat_conversations ADD COLUMN total_tokens INTEGER DEFAULT 0;
`;
