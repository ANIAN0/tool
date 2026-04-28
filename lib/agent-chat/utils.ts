/**
 * AgentChat工具函数
 */

import type { UIMessage, LanguageModelUsage } from "ai";
import type { Message as DBMessage, CheckpointContent } from "@/lib/schemas";

/**
 * 消息元数据类型（用于历史消息显示）
 */
export type MessageMetadata = {
  usage: LanguageModelUsage;
  contextLimit: number;
  modelName: string;
};

/**
 * 将数据库消息转换为UIMessage格式
 * 支持 checkpoint 类型的消息转换
 *
 * @param msg - 数据库消息对象
 * @param metadata - 可选的元数据（contextLimit 和 modelName），用于历史消息显示
 */
export function dbMessageToUIMessage(
  msg: DBMessage,
  metadata?: { contextLimit: number; modelName: string }
): UIMessage {
  // 处理 checkpoint 类型消息
  if (msg.type === "checkpoint") {
    try {
      const checkpointContent = JSON.parse(msg.content) as CheckpointContent;
      // 构造 checkpoint part（使用自定义 part 类型）
      // 注意：checkpoint 是自定义类型，用于前端渲染
      const checkpointPart = {
        type: "checkpoint",
        removedCount: checkpointContent.removedCount,
        originalMessageCount: checkpointContent.originalMessageCount,
        compressedAt: checkpointContent.compressedAt,
      };

      return {
        id: msg.id,
        role: "system",
        parts: [checkpointPart as unknown as UIMessage["parts"][number]],
      };
    } catch {
      // 解析失败，返回空消息
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
      // 用于 Context 组件显示历史消息的 token 用量
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
          } as MessageMetadata,
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
 * 检查消息是否是 checkpoint 类型
 */
export function isCheckpointMessage(msg: UIMessage): boolean {
  return msg.role === "system" && msg.parts.some((p) => isCheckpointPart(p));
}

/**
 * 检查 part 是否是 checkpoint 类型
 */
export function isCheckpointPart(part: { type: string }): boolean {
  return part.type === "checkpoint";
}

/**
 * 从 checkpoint part 提取详细信息
 */
export function getCheckpointInfo(part: { type: string }): {
  removedCount: number;
  originalMessageCount: number;
  compressedAt: number;
} | null {
  if (!isCheckpointPart(part)) return null;

  const checkpointPart = part as unknown as {
    removedCount: number;
    originalMessageCount: number;
    compressedAt: number;
  };

  return {
    removedCount: checkpointPart.removedCount,
    originalMessageCount: checkpointPart.originalMessageCount,
    compressedAt: checkpointPart.compressedAt,
  };
}

/**
 * 检查是否是工具调用的 part
 */
export function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

/**
 * 检查是否是步骤开始的 part
 */
export function isStepStartPart(part: { type: string }): boolean {
  return part.type === "step-start";
}