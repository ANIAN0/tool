/**
 * 响应构建模块
 * 构建流式响应，处理 onFinish 回调中的消息保存、token更新、清理逻辑
 */

import { waitUntil } from "@vercel/functions";
import { nanoid } from "nanoid";
import type { UIMessage, StreamTextResult, FinishReason, TextStreamPart, ToolSet } from "ai";
import {
  createMessage,
  updateConversationTokenTotals,
  touchConversation,
} from "@/lib/db";
import type { StreamResponseConfig } from "./types";

/**
 * 构建流式响应
 * 将 StreamTextResult 转换为 HTTP Response，处理消息保存和清理逻辑
 *
 * @param result - Agent 流执行结果（StreamTextResult）
 * @param config - 响应构建配置
 * @returns HTTP Response 对象（流式响应）
 *
 * @example
 * ```typescript
 * const response = buildStreamResponse(result, {
 *   conversationId: "conv-123",
 *   contextLimit: 32000,
 *   modelName: "gpt-4",
 *   mcpCleanup: cleanupFn,
 * });
 * return response;
 * ```
 */
export function buildStreamResponse<TOOLS extends ToolSet>(
  result: StreamTextResult<TOOLS, never>,
  config: StreamResponseConfig
): Response {
  // 解构配置参数
  const { conversationId, contextLimit, modelName, mcpCleanup } = config;

  // 构建并返回流式响应
  return result.toUIMessageStreamResponse({
    // 发送来源信息（用于显示数据来源）
    sendSources: true,
    // 发送推理过程（用于显示思考链）
    sendReasoning: true,
    // 传递 usage 信息到客户端（用于 Context 组件显示 token 用量）
    messageMetadata: ({ part }: { part: TextStreamPart<TOOLS> }) => {
      // 在 finish 事件时传递 totalUsage 和模型配置
      if (part.type === "finish") {
        return {
          usage: part.totalUsage,
          contextLimit,
          modelName,
        };
      }
      // 非 finish 事件不传递额外元数据
      return undefined;
    },
    // 流结束回调：保存消息、更新统计、清理资源
    onFinish: async ({ responseMessage, finishReason }: {
      responseMessage: UIMessage;
      finishReason?: FinishReason;
    }) => {
      try {
        // 仅在非错误情况下保存消息
        if (finishReason !== "error" && conversationId) {
          try {
            // 获取完整的 usage（所有 step 的累加）
            const usage = await result.totalUsage;

            // 生成 assistant 消息ID
            const messageId = nanoid();
            // 从返回的 responseMessage 中提取内容
            const parts = responseMessage?.parts || [];

            // 组装完整 assistant 消息对象
            const fullMessage: UIMessage = {
              id: messageId,
              role: "assistant",
              parts,
            };

            // 持久化 assistant 消息（带 token 统计）
            await createMessage({
              id: messageId,
              conversationId: conversationId,
              role: "assistant",
              content: JSON.stringify(fullMessage),
              // 保存 token 统计
              input_tokens: usage?.inputTokens,
              output_tokens: usage?.outputTokens,
              total_tokens: usage?.totalTokens,
            });

            // 使用 waitUntil 确保非关键操作在响应后执行
            // 比 after() 更可靠：即使客户端断开连接，操作也会完成
            if (usage) {
              waitUntil(
                updateConversationTokenTotals(conversationId, {
                  inputTokens: usage.inputTokens || 0,
                  outputTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                }).then(() => touchConversation(conversationId))
              );
            } else {
              // 即使没有 usage，也需要更新会话时间
              waitUntil(touchConversation(conversationId));
            }
          } catch (saveError) {
            // 消息落库失败只记录日志，不影响流式返回
            console.error("保存消息失败:", saveError);
          }
        }
      } finally {
        // 无论成功或失败都执行 MCP 客户端清理
        await safeCleanupMcp(mcpCleanup);
      }
    },
  });
}

/**
 * 安全执行 MCP 清理
 * 确保 MCP 连接在请求结束后释放，处理异常情况
 *
 * @param cleanup - MCP 清理函数（可能为 null）
 */
async function safeCleanupMcp(cleanup: (() => Promise<void>) | null): Promise<void> {
  // 没有 MCP 清理函数时直接返回
  if (!cleanup) return;

  try {
    // 执行 MCP 客户端关闭流程
    await cleanup();
  } catch (cleanupError) {
    // 清理失败仅记录告警，不影响主响应
    console.warn("MCP运行时清理失败:", cleanupError);
  }
}