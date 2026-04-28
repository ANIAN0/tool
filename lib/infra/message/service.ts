/**
 * 消息服务实现
 */

import * as dbMessages from "@/lib/db/messages";
import * as dbRetract from "@/lib/db/message-retract";
import type { Message } from "@/lib/schemas";
import type { CheckpointContent } from "@/lib/schemas";
import type {
  MessageService,
  CreateMessageParamsInput,
  UIMessage,
} from "./types";

/**
 * 创建消息服务实例
 */
export function createMessageService(): MessageService {
  return new MessageServiceImpl();
}

/**
 * 消息服务实现类
 */
class MessageServiceImpl implements MessageService {
  /**
   * 创建新消息
   */
  async create(params: CreateMessageParamsInput): Promise<Message> {
    return dbMessages.createMessage(params);
  }

  /**
   * 获取会话的所有消息
   */
  async listBySession(sessionId: string): Promise<Message[]> {
    return dbMessages.getMessages(sessionId);
  }

  /**
   * 删除会话的所有消息
   */
  async deleteBySession(sessionId: string): Promise<number> {
    return dbMessages.deleteMessagesByConversation(sessionId);
  }

  /**
   * 将数据库消息转换为 UIMessage 格式
   */
  toUIMessage(
    msg: Message,
    metadata?: { contextLimit: number; modelName: string }
  ): UIMessage {
    // 处理 checkpoint 类型消息
    if (msg.type === "checkpoint") {
      try {
        const checkpointContent = JSON.parse(msg.content) as CheckpointContent;
        const checkpointPart = {
          type: "checkpoint",
          removedCount: checkpointContent.removedCount,
          originalMessageCount: checkpointContent.originalMessageCount,
          compressedAt: checkpointContent.compressedAt,
        };

        return {
          id: msg.id,
          role: "system",
          parts: [checkpointPart as UIMessage["parts"][number]],
        };
      } catch {
        return {
          id: msg.id,
          role: "system",
          parts: [],
        };
      }
    }

    // 处理普通消息
    try {
      const parsed = JSON.parse(msg.content);
      if (
        parsed &&
        typeof parsed === "object" &&
        "id" in parsed &&
        "role" in parsed &&
        "parts" in parsed &&
        Array.isArray(parsed.parts)
      ) {
        // 如果是 assistant 消息且有 token 统计字段，构造 metadata
        if (
          msg.role === "assistant" &&
          metadata &&
          (msg.input_tokens || msg.output_tokens || msg.total_tokens)
        ) {
          return {
            ...parsed,
            metadata: {
              usage: {
                inputTokens: msg.input_tokens ?? undefined,
                outputTokens: msg.output_tokens ?? undefined,
                totalTokens: msg.total_tokens ?? undefined,
              },
              contextLimit: metadata.contextLimit,
              modelName: metadata.modelName,
            },
          } as UIMessage;
        }

        return parsed as UIMessage;
      }
    } catch {
      // 解析失败，说明是纯文本格式
    }

    return {
      id: msg.id,
      role: msg.role,
      parts: [{ type: "text", text: msg.content }],
    };
  }

  /**
   * 撤回消息
   */
  async retract(
    messageId: string,
    userId: string,
    reason: "user-delete" | "edit-regenerate"
  ): Promise<boolean> {
    const result = await dbRetract.retractMessage(messageId, userId, reason);
    return result.deletedCount > 0;
  }
}