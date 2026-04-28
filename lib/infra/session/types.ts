/**
 * 会话服务类型定义
 * 提供统一抽象接口，分离数据层和业务层
 */

import type { Conversation } from "@/lib/schemas";

// ==================== Session 相关类型 ====================

/**
 * 会话基础接口
 * 定义标准的会话 CRUD 操作
 */
export interface SessionService {
  /**
   * 创建新会话
   */
  create(params: CreateSessionParams): Promise<Session>;

  /**
   * 获取会话详情
   * @param id 会话ID
   * @returns 会话对象，不存在返回 null
   */
  get(id: string): Promise<Session | null>;

  /**
   * 获取用户的所有会话列表
   * @param userId 用户ID
   * @returns 会话列表，按更新时间倒序
   */
  listByUser(userId: string): Promise<Session[]>;

  /**
   * 更新会话信息
   * @param id 会话ID
   * @param data 更新数据
   * @returns 更新后的会话，不存在返回 null
   */
  update(id: string, data: UpdateSessionParams): Promise<Session | null>;

  /**
   * 删除会话
   * @param id 会话ID
   * @returns 是否删除成功
   */
  delete(id: string): Promise<boolean>;

  /**
   * 更新会话的访问时间
   * 用于发送新消息后更新会话时间戳
   * @param id 会话ID
   */
  touch(id: string): Promise<void>;
}

/**
 * Chat 会话服务扩展接口（aisdk agent 专有）
 * 包含 token 汇总和压缩缓存功能
 */
export interface ChatSessionService extends SessionService {
  /**
   * 更新会话的 token 汇总
   * 每次助手回复后累加 token 使用量
   * @param id 会话ID
   * @param usage token 使用统计
   */
  updateTokenTotals(id: string, usage: TokenUsage): Promise<void>;

  /**
   * 更新会话的压缩缓存
   * 压缩完成后存储压缩后的消息快照
   * @param id 会话ID
   * @param cache 压缩缓存数据
   */
  updateCompressionCache(id: string, cache: CompressionCache): Promise<void>;

  /**
   * 清除会话的压缩缓存
   * 用户手动删除消息后需要清除缓存
   * @param id 会话ID
   */
  clearCompressionCache(id: string): Promise<void>;

  /**
   * 获取用户会话列表（支持 source 过滤）
   * @param userId 用户ID
   * @param options 可选的过滤选项
   */
  listByUserWithFilter(userId: string, options?: { source?: string }): Promise<Session[]>;
}

/**
 * Workflow 会话服务扩展接口（workflow agent 专有）
 * 包含 CAS 原子操作管理活跃流
 */
export interface WorkflowSessionService extends SessionService {
  /**
   * 幂等 claim：slot 为空或已被自己占用时成功
   * @param id 会话ID
   * @param workflowRunId 工作流运行ID
   * @returns true 表示 claim 成功，false 表示被他人占用
   */
  claimActiveStreamId(id: string, workflowRunId: string): Promise<boolean>;

  /**
   * 严格 CAS：仅当 active_stream_id 等于 expected 时更新为 next
   * @param id 会话ID
   * @param expected 期望的当前值
   * @param next 要设置的新值
   * @returns true 表示 CAS 成功，false 表示当前值不匹配
   */
  compareAndSetActiveStreamId(
    id: string,
    expected: string | null,
    next: string | null
  ): Promise<boolean>;

  /**
   * 直接清除 active_stream_id（兜底场景）
   * @param id 会话ID
   */
  clearActiveStreamId(id: string): Promise<void>;
}

// ==================== 参数类型 ====================

/**
 * 创建会话的参数类型
 */
export interface CreateSessionParams {
  id: string;
  userId: string;
  title?: string;
  model?: string;
  agentId?: string;
  isPrivate?: boolean;
  source?: string;
}

/**
 * 更新会话的参数类型
 */
export interface UpdateSessionParams {
  title?: string;
  model?: string;
}

/**
 * Token 使用量类型
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * 压缩缓存类型
 */
export interface CompressionCache {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    parts: Array<{
      type: string;
      text?: string;
      toolCallId?: string;
      input?: unknown;
      output?: unknown;
      state?: string;
      errorText?: string;
    }>;
  }>;
  messageCount: number;
  removedCount: number;
  compressedAt: number;
}

// ==================== Session 类型 ====================

/**
 * Session 类型定义
 * 统一会话对象格式
 */
export interface Session {
  id: string;
  userId: string;
  title: string | null;
  model: string | null;
  agentId: string;
  isPrivate: boolean;
  source: string;
  createdAt: number;
  updatedAt: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  compressionCache: string | null;
}

/**
 * WorkflowSession 扩展类型
 * 包含活跃流信息
 */
export interface WorkflowSession extends Session {
  activeStreamId: string | null;
  lastMessageAt: number;
}

/**
 * Workflow 专用会话创建参数
 */
export interface WorkflowCreateSessionParams {
  id: string;
  userId?: string | null;
  title?: string | null;
}

// ==================== 转换函数 ====================

/**
 * 将数据库 Conversation 转换为 Session
 */
export function conversationToSession(conv: Conversation): Session {
  return {
    id: conv.id,
    userId: conv.user_id,
    title: conv.title,
    model: conv.model,
    agentId: conv.agent_id,
    isPrivate: conv.is_private,
    source: conv.source,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    totalInputTokens: conv.total_input_tokens,
    totalOutputTokens: conv.total_output_tokens,
    totalTokens: conv.total_tokens,
    compressionCache: conv.compression_cache,
  };
}

/**
 * 将 Session 转换回数据库格式（用于创建/更新）
 */
export function sessionToDbParams(session: Session): {
  id: string;
  userId: string;
  title: string | null;
  model: string | null;
  agentId: string;
  isPrivate: boolean;
  source: string;
} {
  return {
    id: session.id,
    userId: session.userId,
    title: session.title,
    model: session.model,
    agentId: session.agentId,
    isPrivate: session.isPrivate,
    source: session.source,
  };
}