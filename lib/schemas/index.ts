/**
 * Schema 统一导出入口
 * 所有 schema 相关的 SQL 语句和类型定义都可从此文件导入
 */

// 用户表
export {
  CREATE_USERS_TABLE,
} from './user';
export type {
  User,
  CreateUserParams,
} from './user';

// 对话和消息表
export {
  CREATE_CONVERSATIONS_TABLE,
  MIGRATION_ADD_AGENT_ID,
  MIGRATION_ADD_IS_PRIVATE,
  MIGRATION_ADD_SOURCE,
  CREATE_MESSAGES_TABLE,
  MIGRATION_ADD_MESSAGE_TOKEN_FIELDS,
  MIGRATION_ADD_CONVERSATION_TOKEN_FIELDS,
  MIGRATION_ADD_COMPRESSION_CACHE,
  MIGRATION_ADD_MESSAGE_TYPE,
  CREATE_CONVERSATION_INDEXES,
} from './conversation';
export type {
  Conversation,
  Message,
  MessagePart,
  FullMessage,
  CreateConversationParams,
  CreateMessageParams,
} from './conversation';

// Agent表
export {
  CREATE_AGENTS_TABLE,
  CREATE_AGENT_TOOLS_TABLE,
  CREATE_AGENTS_INDEXES,
} from './agent';
export type {
  Agent,
  AgentTool,
  CreateAgentParams,
  UpdateAgentParams,
  AgentWithTools,
  PublicAgentWithCreator,
} from './agent';

// MCP服务器和Skill表
export {
  CREATE_USER_MCP_SERVERS_TABLE,
  CREATE_MCP_TOOLS_TABLE,
  CREATE_MCP_SERVERS_INDEXES,
  MIGRATION_ADD_SKILL_FILE_COUNT,
  CREATE_USER_SKILLS_TABLE,
  CREATE_AGENT_SKILLS_TABLE,
  CREATE_SKILLS_INDEXES,
} from './tool';
export type {
  McpServer,
  McpStatus,
  McpStatusResult,
  McpTool,
  SystemTool,
  Tool,
  CreateMcpServerParams,
  UpdateMcpServerParams,
  UserSkill,
  AgentSkill,
  CreateUserSkillParams,
  UpdateUserSkillParams,
  SkillValidationResult,
  UserSkillWithAgentCount,
} from './tool';

// 系统表（压缩、检查点、消息撤回）
export {
  CREATE_COMPRESSION_TASKS_TABLE,
  CREATE_COMPRESSION_TASKS_INDEXES,
  CREATE_CHECKPOINTS_TABLE,
  MIGRATION_ADD_CHECKPOINT_CACHE_CONTENT,
  CREATE_CHECKPOINTS_INDEXES,
  CREATE_DELETED_MESSAGES_TABLE,
  CREATE_DELETED_MESSAGES_INDEXES,
  CompressionTaskStatus,
} from './system';
export type {
  CompressionTask,
  Checkpoint,
  CreateCompressionTaskParams,
  CreateCheckpointRecordParams,
  DeletedMessage,
  CreateDeletedMessageParams,
  CompressionCache,
  CheckpointContent,
} from './system';

// 文档系统表
export {
  CREATE_FOLDERS_TABLE,
  CREATE_DOCUMENTS_TABLE,
  CREATE_DOC_INDEXES,
} from './document';
export type {
  Folder,
  Document,
  CreateFolderParams,
  CreateDocumentParams,
} from './document';

// API Key表
export {
  CREATE_USER_API_KEYS_TABLE,
  CREATE_API_KEYS_INDEXES,
} from './api-key';
export type {
  UserApiKey,
  CreateUserApiKeyParams,
  ApiKeyListItem,
} from './api-key';

// 用户模型表
export {
  CREATE_USER_MODELS_TABLE,
  MIGRATION_ADD_CONTEXT_LIMIT,
  CREATE_USER_MODEL_INDEXES,
} from './model';
export type {
  UserModel,
  CreateUserModelParams,
  UpdateUserModelParams,
} from './model';

// WorkflowChat表
export {
  CREATE_WORKFLOWCHAT_CONVERSATIONS_TABLE,
  CREATE_WORKFLOWCHAT_MESSAGES_TABLE,
  CREATE_WORKFLOWCHAT_RUNS_TABLE,
  CREATE_WORKFLOWCHAT_RUN_STEPS_TABLE,
  CREATE_WORKFLOWCHAT_CONVERSATION_INDEXES,
  CREATE_WORKFLOWCHAT_MESSAGE_INDEXES,
  CREATE_WORKFLOWCHAT_RUN_INDEXES,
  CREATE_WORKFLOWCHAT_RUN_STEP_INDEXES,
  CREATE_WORKFLOWCHAT_INDEXES,
} from './workflowchat';
export type {
  WorkflowChatConversationStatus,
  WorkflowChatRunStatus,
  WorkflowChatStepStatus,
  WorkflowChatConversation,
  WorkflowChatMessage,
  WorkflowChatRun,
  WorkflowChatRunStep,
} from './workflowchat';