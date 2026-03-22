/**
 * AgentChat工具函数
 */

import type { UIMessage } from "ai";
import type { Message as DBMessage } from "@/lib/db/schema";

/**
 * 将数据库消息转换为UIMessage格式
 */
export function dbMessageToUIMessage(msg: DBMessage): UIMessage {
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