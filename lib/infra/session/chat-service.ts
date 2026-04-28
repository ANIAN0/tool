/**
 * Chat 会话服务实现
 * aisdk agent 专有，包含 token 汇总和压缩缓存功能
 */

import * as dbConversations from "@/lib/db/conversations";
import type {
  ChatSessionService,
  CreateSessionParams,
  UpdateSessionParams,
  Session,
  TokenUsage,
  CompressionCache,
} from "./types";
import { conversationToSession } from "./types";

/**
 * 创建 Chat 会话服务实例
 */
export function createChatSessionService(): ChatSessionService {
  return new ChatSessionServiceImpl();
}

/**
 * Chat 会话服务实现类
 */
class ChatSessionServiceImpl implements ChatSessionService {
  /**
   * 创建新会话
   */
  async create(params: CreateSessionParams): Promise<Session> {
    const conversation = await dbConversations.createConversation({
      id: params.id,
      userId: params.userId,
      title: params.title,
      model: params.model,
      agentId: params.agentId,
      isPrivate: params.isPrivate,
      source: params.source,
    });
    return conversationToSession(conversation);
  }

  /**
   * 获取会话详情
   */
  async get(id: string): Promise<Session | null> {
    const conversation = await dbConversations.getConversation(id);
    return conversation ? conversationToSession(conversation) : null;
  }

  /**
   * 获取用户的所有会话列表
   */
  async listByUser(userId: string): Promise<Session[]> {
    const conversations = await dbConversations.getConversations(userId);
    return conversations.map(conversationToSession);
  }

  /**
   * 更新会话信息
   */
  async update(
    id: string,
    data: UpdateSessionParams
  ): Promise<Session | null> {
    const conversation = await dbConversations.updateConversation(id, {
      title: data.title,
      model: data.model,
    });
    return conversation ? conversationToSession(conversation) : null;
  }

  /**
   * 删除会话
   */
  async delete(id: string): Promise<boolean> {
    return dbConversations.deleteConversation(id);
  }

  /**
   * 更新会话的访问时间
   */
  async touch(id: string): Promise<void> {
    await dbConversations.touchConversation(id);
  }

  /**
   * 更新会话的 token 汇总
   */
  async updateTokenTotals(id: string, usage: TokenUsage): Promise<void> {
    await dbConversations.updateConversationTokenTotals(id, usage);
  }

  /**
   * 更新会话的压缩缓存
   */
  async updateCompressionCache(
    id: string,
    cache: CompressionCache
  ): Promise<void> {
    await dbConversations.updateCompressionCache(id, cache);
  }

  /**
   * 清除会话的压缩缓存
   */
  async clearCompressionCache(id: string): Promise<void> {
    await dbConversations.clearCompressionCache(id);
  }

  /**
   * 获取用户会话列表（支持 source 过滤）
   */
  async listByUserWithFilter(
    userId: string,
    options?: { source?: string }
  ): Promise<Session[]> {
    const conversations = await dbConversations.getConversationsWithFilter(
      userId,
      options
    );
    return conversations.map(conversationToSession);
  }
}