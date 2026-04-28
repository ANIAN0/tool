/**
 * WorkflowChat 服务层
 * 封装会话管理、消息处理、run 创建、active stream 协调等业务逻辑
 */

import { nanoid } from 'nanoid';
import { start, getRun } from 'workflow/api';
import type { Run } from 'workflow/api';
import type { UIMessage, ToolSet } from 'ai';

import { workflowchatReplyWorkflow } from '@/app/workflows/workflowchat';
import { loadAgentConfig } from '@/lib/workflowchat/agent-loader';
import { createTools, initTools } from '@/lib/infra/tools';
import { createAgentSkillTools } from '@/lib/infra/skills';
import type { AgentConfig, SkillConfig } from '@/lib/workflowchat/agent-loader';

import {
  createWfChatConversation,
  getWfChatConversation,
  getWfChatConversationsByUserId,
  getAllWfChatConversations,
  updateWfChatConversation,
  deleteWfChatConversation,
  touchWfChatConversation,
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
    agentId: conv.agent_id,
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

/** 发送消息时遇到 Agent 配置加载失败 */
export class SendMessageAgentConfigError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'SendMessageAgentConfigError';
  }
}

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

/** 发送消息时 Agent ID 不匹配 */
export class SendMessageAgentMismatchError extends Error {
  constructor(
    message: string,
    public readonly expectedAgentId: string,
    public readonly providedAgentId: string,
  ) {
    super(message);
    this.name = 'SendMessageAgentMismatchError';
  }
}

// ==================== Active Stream 内部检查 ====================

/**
 * 检查会话活跃流状态（公共底层逻辑）
 *
 * 检查会话的 active_stream_id 是否有残留：
 * 1. 如果 active_stream_id 为空，直接返回
 * 2. 查找对应的 run，如果 run 已终态，CAS 清除并返回
 * 3. 如果 run 存在且仍在运行，返回 run 信息
 * 4. 如果找不到对应 run 记录，直接清除残留
 *
 * @param conversationId - 会话 id
 * @returns 活跃流检查结果
 */
async function inspectActiveStream(
  conversationId: string,
): Promise<{
  activeStreamId: string | null;
  run: WorkflowChatRun | null;
  isStale: boolean;
  isActive: boolean;
}> {
  const conversation = await getWfChatConversation(conversationId);
  if (!conversation || !conversation.active_stream_id) {
    return { activeStreamId: null, run: null, isStale: false, isActive: false };
  }

  const activeStreamId = conversation.active_stream_id;
  const run = await getWfChatRunByWorkflowRunId(activeStreamId);

  if (!run) {
    // 找不到对应 run 记录，CAS 清除残留（避免竞态抹掉新 claim）
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return { activeStreamId, run: null, isStale: true, isActive: false };
  }

  // run 已终态，CAS 清除 stale activeStreamId
  if (TERMINAL_STATUSES.has(run.status)) {
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return { activeStreamId, run, isStale: true, isActive: false };
  }

  // run 仍在运行
  return { activeStreamId, run, isStale: false, isActive: true };
}

// ==================== reconcileExistingActiveStream ====================

/**
 * reconcile stale activeStreamId
 *
 * @param conversationId - 会话 id
 * @returns 如果发现仍在运行的活跃 run，返回其 DTO；否则返回 null
 */
export async function reconcileExistingActiveStream(
  conversationId: string,
): Promise<RunDTO | null> {
  const { run, isActive } = await inspectActiveStream(conversationId);
  if (!isActive) return null;
  return runToDTO(run!);
}

// ==================== 业务函数 ====================

/**
 * sendMessage 完整流程
 *
 * 1. 加载 Agent 配置（loadAgentConfig）获取 maxSteps、tools、skills
 * 2. 校验 agentId 与会话绑定的 agentId 是否一致
 * 3. 创建工具实例（createAgentTools）
 * 4. 写入 user message
 * 5. 创建 run 记录（status=pending，workflow_run_id 为 null）
 * 6. reconcileExistingActiveStream：检查 active_stream_id 是否有 stale 残留
 * 7. 如果 active_stream_id 非空且对应 run 仍在运行，重连已有 stream
 * 8. start(workflowchatReplyWorkflow) 启动 workflow
 * 9. claimChatActiveStreamId CAS claim（双保障第一层）
 * 10. 如果 CAS 失败（slot 已被其他 run 占用），取消刚启动的 workflow，返回 409
 * 11. 回填 workflow_run_id 到 run 记录
 * 12. 返回 SendMessageResult
 *
 * @param conversationId - 会话 id
 * @param agentId - Agent ID，用于校验与会话绑定的 Agent 是否一致
 * @param userId - 用户 id，必填（用于加载 Agent 配置）
 * @param content - 消息内容（AI SDK UIMessage 格式的 parts JSON 字符串）
 * @param modelId - 可选模型 id，不传时使用 Agent 配置中的 modelId
 * @returns SendMessageResult 包含 run 信息和 workflow Run 句柄
 * @throws SendMessageAgentConfigError - Agent 配置加载失败
 * @throws SendMessageAgentMismatchError - agentId 与会话绑定的 agentId 不一致
 * @throws SendMessageConflictError - CAS claim 失败或已有活跃 run
 * @throws SendMessageConfigError - 环境变量缺失
 */
export async function sendMessage(
  conversationId: string,
  agentId: string,
  userId: string | null,
  content: string,
  modelId?: string,
): Promise<{ runDTO: RunDTO; workflowRun: Run<unknown> }> {
  console.log("[sendMessage] 入口, conversationId:", conversationId, "agentId:", agentId, "userId:", userId, "content:", content.slice(0, 100), "modelId:", modelId);

  // 步骤 0：验证用户身份（必须登录才能使用 Agent）
  if (!userId) {
    throw new SendMessageConfigError('用户身份验证失败，请先登录');
  }

  // 步骤 1：加载 Agent 配置（关键步骤）
  const agentConfigResult = await loadAgentConfig(userId, agentId);
  if (!agentConfigResult.ok) {
    throw new SendMessageAgentConfigError(
      agentConfigResult.error ?? 'Agent 配置加载失败',
      agentConfigResult.status ?? 500,
    );
  }
  const agentConfig: AgentConfig = agentConfigResult.agent!;

  console.log("[sendMessage] Agent 配置加载成功:", {
    id: agentConfig.id,
    name: agentConfig.name,
    modelId: agentConfig.modelId,
    maxSteps: agentConfig.maxSteps,
    toolsCount: agentConfig.tools.length,
    skillsCount: agentConfig.skills.length,
  });

  // 验证会话存在
  const conversation = await getWfChatConversation(conversationId);
  if (!conversation) {
    throw new Error(`会话不存在: ${conversationId}`);
  }

  // 校验 agentId：确保传入的 agentId 与会话绑定的 agentId 一致
  if (conversation.agent_id !== agentId) {
    throw new SendMessageAgentMismatchError(
      `Agent ID 不匹配：会话绑定的 agent_id 为 ${conversation.agent_id}，传入的为 ${agentId}`,
      conversation.agent_id,
      agentId,
    );
  }

  // 步骤 2：创建工具实例（关键步骤）
  const tools = await createAgentTools(agentConfig, userId, conversationId);
  console.log("[sendMessage] 工具创建成功，工具数量:", Object.keys(tools).length);

  // 使用传入的 modelId 或 Agent 配置中的 modelId
  const resolvedModelId = modelId ?? agentConfig.modelId ?? '';
  if (!resolvedModelId) {
    throw new SendMessageConfigError(
      '模型 ID 未指定且 Agent 配置中无默认模型',
    );
  }

  // 步骤 3：写入 user message
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

  // 步骤 4：创建 run 记录（status=pending，workflow_run_id 为 null）
  const runId = nanoid();
  const run = await createWfChatRun({
    id: runId,
    conversationId,
    workflowRunId: null,
    workflowName: WORKFLOWCHAT_REPLY_WORKFLOW_NAME,
    modelId: resolvedModelId,
    requestMessageId: userMessageId,
  });

  // 步骤 5：reconcile stale activeStreamId
  const activeRun = await reconcileExistingActiveStream(conversationId);

  // 步骤 6：如果 active run 仍在运行，标记刚创建的 run 为 failed 并返回冲突
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

  // 构建完整的 workflow 输入参数（包含 Agent 配置）
  const workflowInput: WorkflowChatRunInput = {
    conversationId,
    runId,
    requestMessageId: userMessageId,
    agentId,
    userId,
    modelId: resolvedModelId,
    messages: uiMessages,
    // Agent 运行时配置
    maxSteps: agentConfig.maxSteps,
    customInstructions: agentConfig.customInstructions,
    // 工具集合（已创建的实例）
    tools,
    // Skill 配置
    skills: agentConfig.skills,
  };

  console.log("[sendMessage] workflowInput 构建完成:", {
    maxSteps: workflowInput.maxSteps,
    customInstructions: workflowInput.customInstructions ? '已设置' : '无',
    toolsCount: Object.keys(workflowInput.tools ?? {}).length,
    skillsCount: workflowInput.skills?.length ?? 0,
  });
  console.log("[sendMessage] workflowInput.messages 数量:", uiMessages.length);

  // 步骤 7：启动 workflow
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

  // 步骤 8：CAS claim active_stream_id
  const claimSuccess = await claimChatActiveStreamId(
    conversationId,
    workflowRun.runId,
  );

  // 步骤 9：CAS 失败，取消刚启动的 workflow，返回 409
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

  // 步骤 10：回填 workflow_run_id 到 run 记录
  await updateWfChatRun(runId, {
    workflowRunId: workflowRun.runId,
    status: WORKFLOWCHAT_RUN_STATUS.RUNNING,
    startedAt: Date.now(),
  });

  // 步骤 11：返回结果
  const updatedRun = await getWfChatRun(runId);
  return {
    runDTO: runToDTO(updatedRun!),
    workflowRun,
  };
}

/**
 * 创建 Agent 工具集合
 * 将配置中的工具定义和 Skill 定义转换为实际可用的 Tool 实例
 *
 * @param agentConfig - Agent 配置
 * @param userId - 用户 ID
 * @param conversationId - 会话 ID
 * @returns 工具集合（ToolSet）
 */
async function createAgentTools(
  agentConfig: AgentConfig,
  userId: string,
  conversationId: string,
): Promise<ToolSet> {
  const tools: ToolSet = {};

  // 1. 根据工具配置创建系统工具实例
  if (agentConfig.tools.length > 0) {
    const toolNames = agentConfig.tools.map((tool) => tool.name);

    try {
      // 按需初始化工具定义
      initTools(toolNames);
      // 创建工具实例
      const result = await createTools(toolNames);
      Object.assign(tools, result.tools);
    } catch (error) {
      console.error("[createAgentTools] 系统工具创建失败:", error);
      // 系统工具创建失败不阻塞流程，继续使用空工具集
    }
  }

  // 2. 根据 Skill 配置创建 Skill 工具实例
  if (agentConfig.skills.length > 0) {
    try {
      const skillResult = await createAgentSkillTools(
        agentConfig.id,
        userId,
        conversationId,
      );
      Object.assign(tools, skillResult.tools);
      console.log("[createAgentTools] Skill 工具创建成功:", {
        skillCount: agentConfig.skills.length,
        toolCount: Object.keys(skillResult.tools).length,
      });
    } catch (error) {
      console.error("[createAgentTools] Skill 工具创建失败:", error);
      // Skill 工具创建失败不阻塞流程，继续使用已创建的系统工具
    }
  }

  return tools;
}

/**
 * 启动消息流程的简化入口
 * 仅启动 workflow 并返回 Run 和 workflowRunId，不关心流式输出
 * 适用于 sendMessage 后由 API 路由层处理流式响应的场景
 */
export async function startWorkflowRun(
  conversationId: string,
  agentId: string,
  userId: string | null,
  content: string,
  modelId?: string,
): Promise<{ runDTO: RunDTO; workflowRun: Run<unknown> }> {
  return sendMessage(conversationId, agentId, userId, content, modelId);
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
 * @param agentId - Agent ID，必填
 * @param userId - 用户 ID，可选
 * @param title - 会话标题，可选
 */
export async function createConversation(
  agentId: string,
  userId?: string | null,
  title?: string | null,
): Promise<ConversationDTO> {
  const conversation = await createWfChatConversation({
    id: nanoid(),
    agentId,
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
  const { activeStreamId, isActive } = await inspectActiveStream(conversationId);
  if (!isActive || !activeStreamId) return null;

  // run 仍在运行，获取 Run 句柄
  try {
    return getRun(activeStreamId);
  } catch {
    // Run 不存在于 World 侧，CAS 清除残留（避免竞态抹掉新 claim）
    await compareAndSetActiveStreamId(conversationId, activeStreamId, null);
    return null;
  }
}

