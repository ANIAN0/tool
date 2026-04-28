/**
 * 消息服务类型定义
 */

import type { Message, CreateMessageParams } from "@/lib/schemas";
import type { CheckpointContent } from "@/lib/schemas";

/**
 * 消息元数据类型
 */
export interface MessageMetadata {
  usage: LanguageModelUsage;
  contextLimit: number;
  modelName: string;
}

/**
 * 语言模型使用量类型
 */
export interface LanguageModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/**
 * 消息服务接口
 */
export interface MessageService {
  /**
   * 创建新消息
   */
  create(params: CreateMessageParamsInput): Promise<Message>;

  /**
   * 获取会话的所有消息
   * @param sessionId 会话ID
   * @returns 消息列表，按创建时间升序
   */
  listBySession(sessionId: string): Promise<Message[]>;

  /**
   * 删除会话的所有消息
   * @param sessionId 会话ID
   * @returns 删除的消息数量
   */
  deleteBySession(sessionId: string): Promise<number>;

  /**
   * 将数据库消息转换为 UIMessage 格式
   * @param msg 数据库消息对象
   * @param metadata 可选的元数据（contextLimit 和 modelName）
   */
  toUIMessage(msg: Message, metadata?: { contextLimit: number; modelName: string }): UIMessage;

  /**
   * 撤回消息
   * @param messageId 消息ID
   * @param userId 操作用户ID
   * @param reason 删除原因
   * @returns 是否撤回成功
   */
  retract(messageId: string, userId: string, reason: "user-delete" | "edit-regenerate"): Promise<boolean>;
}

/**
 * 创建消息的参数类型
 */
export interface CreateMessageParamsInput {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

/**
 * UIMessage 类型定义（简化版）
 */
export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: UIMessagePart[];
  metadata?: MessageMetadata;
}

/**
 * UIMessage Part 类型
 */
export type UIMessagePart =
  | { type: "text"; text: string }
  | { type: `tool-${string}`; toolCallId: string; input: unknown; output: unknown; state: string; errorText?: string }
  | { type: "dynamic-tool"; toolName: string; toolCallId: string; input: unknown; output: unknown; state: string; errorText?: string }
  | { type: "step-start" }
  | {
      type: "checkpoint";
      removedCount: number;
      originalMessageCount: number;
      compressedAt: number;
    };