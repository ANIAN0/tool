/**
 * 会话服务实现
 * 提供基础 CRUD 功能
 */

import * as dbConversations from "@/lib/db/conversations";
import type {
  SessionService,
  CreateSessionParams,
  UpdateSessionParams,
  Session,
} from "./types";
import { conversationToSession } from "./types";

/**
 * 创建基础会话服务实例
 */
export function createSessionService(): SessionService {
  return new BasicSessionService();
}

/**
 * 基础会话服务实现类
 */
class BasicSessionService implements SessionService {
  /**
   * 创建新会话
   */
  async create(params: CreateSessionParams): Promise<Session> {
    const dbParams: CreateConversationParams = {
      id: params.id,
      userId: params.userId,
      title: params.title,
      model: params.model,
      agentId: params.agentId,
      isPrivate: params.isPrivate,
      source: params.source,
    };

    const conversation = await dbConversations.createConversation(dbParams);
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
}