/**
 * Workflow 会话服务实现
 * workflow agent 专有，包含 CAS 原子操作管理活跃流
 */

import * as wfRepo from "@/lib/workflowchat/repository";
import type {
  WorkflowSessionService,
  CreateSessionParams,
  UpdateSessionParams,
  WorkflowSession,
  CreateConversationParams,
} from "./types";

/**
 * 创建 Workflow 会话服务实例
 */
export function createWorkflowSessionService(): WorkflowSessionService {
  return new WorkflowSessionServiceImpl();
}

/**
 * Workflow 会话服务实现类
 */
class WorkflowSessionServiceImpl implements WorkflowSessionService {
  /**
   * 创建新会话
   */
  async create(params: CreateSessionParams): Promise<WorkflowSession> {
    const conversation = await wfRepo.createWfChatConversation({
      id: params.id,
      userId: params.userId,
      title: params.title ?? null,
    });
    return {
      id: conversation.id,
      userId: conversation.user_id ?? "",
      title: conversation.title,
      model: null,
      agentId: "workflow",
      isPrivate: false,
      source: "workflow",
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      compressionCache: null,
      activeStreamId: conversation.active_stream_id,
      lastMessageAt: conversation.last_message_at,
    };
  }

  /**
   * 获取会话详情
   */
  async get(id: string): Promise<WorkflowSession | null> {
    const conversation = await wfRepo.getWfChatConversation(id);
    if (!conversation) return null;

    return {
      id: conversation.id,
      userId: conversation.user_id ?? "",
      title: conversation.title,
      model: null,
      agentId: "workflow",
      isPrivate: false,
      source: "workflow",
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      compressionCache: null,
      activeStreamId: conversation.active_stream_id,
      lastMessageAt: conversation.last_message_at,
    };
  }

  /**
   * 获取用户的所有会话列表
   */
  async listByUser(userId: string): Promise<WorkflowSession[]> {
    const conversations = await wfRepo.getWfChatConversationsByUserId(userId);
    return conversations.map(this.toWorkflowSession);
  }

  /**
   * 更新会话信息
   */
  async update(
    id: string,
    data: UpdateSessionParams
  ): Promise<WorkflowSession | null> {
    const conversation = await wfRepo.updateWfChatConversation(id, {
      title: data.title,
    });
    return conversation ? this.toWorkflowSession(conversation) : null;
  }

  /**
   * 删除会话
   */
  async delete(id: string): Promise<boolean> {
    return wfRepo.deleteWfChatConversation(id);
  }

  /**
   * 更新会话的访问时间
   */
  async touch(id: string): Promise<void> {
    await wfRepo.touchWfChatConversation(id);
  }

  /**
   * 幂等 claim：slot 为空或已被自己占用时成功
   */
  async claimActiveStreamId(
    id: string,
    workflowRunId: string
  ): Promise<boolean> {
    return wfRepo.claimChatActiveStreamId(id, workflowRunId);
  }

  /**
   * 严格 CAS：仅当 active_stream_id 等于 expected 时更新为 next
   */
  async compareAndSetActiveStreamId(
    id: string,
    expected: string | null,
    next: string | null
  ): Promise<boolean> {
    return wfRepo.compareAndSetActiveStreamId(id, expected, next);
  }

  /**
   * 直接清除 active_stream_id
   */
  async clearActiveStreamId(id: string): Promise<void> {
    await wfRepo.clearActiveStreamId(id);
  }

  /**
   * 转换数据库模型为 WorkflowSession
   */
  private toWorkflowSession(
    conversation: Awaited<ReturnType<typeof wfRepo.getWfChatConversation>>
  ): WorkflowSession {
    if (!conversation) {
      throw new Error("Conversation is null");
    }
    return {
      id: conversation.id,
      userId: conversation.user_id ?? "",
      title: conversation.title,
      model: null,
      agentId: "workflow",
      isPrivate: false,
      source: "workflow",
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      compressionCache: null,
      activeStreamId: conversation.active_stream_id,
      lastMessageAt: conversation.last_message_at,
    };
  }
}