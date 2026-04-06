/**
 * 编辑重发 API
 * PUT /api/messages/[id]/edit-regenerate
 *
 * 编辑用户消息并重新生成回复
 * 自动撤回后续消息并归档
 */

import { NextRequest } from "next/server";
import { editAndRegenerate } from "@/lib/db/message-retract";
import { authenticateRequestOptional } from "@/lib/auth/middleware";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, UIMessage } from "ai";
import type { ToolSet } from "ai";
import { ToolLoopAgent, stepCountIs } from "ai";
import { nanoid } from "nanoid";
import {
  getConversation,
  getUserModelById,
  createMessage,
  touchConversation,
  clearCompressionCache,
  updateConversationTokenTotals,
  type UserModel,
} from "@/lib/db";
import { decryptApiKey } from "@/lib/encryption";
// 新增：异步压缩相关
import {
  getPendingCompressionTask,
  completeCompressionTask,
  loadHistoryMessages,
  executeCompressionTask,
} from "@/lib/db/compression";
import { wrapModelWithAllMiddlewares } from "@/lib/ai";
import { getSandboxToolsWithContext } from "@/lib/sandbox";
import { createAgentMcpRuntimeTools } from "@/lib/agents/mcp-runtime";
import { mergeAgentToolSets } from "@/lib/agents/toolset-merge";
import { getAgentById, getAgentSkillsInfo } from "@/lib/db/agents";
import { loadSkillsToSandbox } from "@/lib/sandbox/skill-loader";
import { isSandboxEnabled } from "@/lib/sandbox/config";

// 设置最大响应时间为 60 秒
export const maxDuration = 60;

/**
 * 根据用户模型配置构建聊天模型
 */
function buildChatModelFromUserModel(userModel: {
  provider: string;
  api_key: string;
  base_url: string | null;
  model: string;
}) {
  if (userModel.provider !== "openai") {
    throw new Error("当前仅支持 OpenAI-Compatible（provider=openai）");
  }

  const decryptedApiKey = decryptApiKey(userModel.api_key);
  const baseURL = userModel.base_url || "https://api.openai.com/v1";

  const provider = createOpenAICompatible({
    name: "user-openai-compatible",
    baseURL,
    apiKey: decryptedApiKey,
  });

  return provider.chatModel(userModel.model);
}

/**
 * PUT /api/messages/[id]/edit-regenerate
 * 编辑消息并重新生成回复
 *
 * 请求参数：
 * - id: 消息ID（URL路径参数）
 * - content: 新的消息内容（UIMessage.parts 格式）
 *
 * 响应格式：
 * 流式响应（复用 agent-chat 的 streaming 逻辑）
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户身份
  const authResult = await authenticateRequestOptional(req);
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const userId = authResult.userId;
  const { id: messageId } = await params;

  try {
    // 解析请求体
    const body = await req.json();
    const { content: newParts } = body;

    if (!newParts || !Array.isArray(newParts)) {
      return new Response(
        JSON.stringify({ error: "消息内容格式无效" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 构建新的消息内容
    const newContent = JSON.stringify({
      id: messageId,
      role: "user",
      parts: newParts,
    } as UIMessage);

    // 执行编辑并级联删除后续消息
    const updatedMessage = await editAndRegenerate(messageId, newContent, userId);

    // 清除压缩缓存（编辑消息后需要重新计算）
    await clearCompressionCache(updatedMessage.conversation_id);

    // 获取对话信息
    const conversation = await getConversation(updatedMessage.conversation_id);
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "对话不存在" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 获取 Agent 配置
    const agent = await getAgentById(conversation.agent_id, userId);
    if (!agent) {
      return new Response(
        JSON.stringify({ error: "Agent不存在" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 获取模型配置
    let chatModel;
    let userModel: UserModel | null = null;
    let modelName = ""; // 模型名称（用于 Context 组件）
    if (agent.model_id) {
      const modelConfig = await getUserModelById(agent.user_id, agent.model_id);
      if (!modelConfig) {
        return new Response(
          JSON.stringify({ error: "模型配置不存在" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      userModel = modelConfig;
      modelName = modelConfig.model;
      chatModel = buildChatModelFromUserModel(modelConfig);
    } else {
      return new Response(
        JSON.stringify({ error: "Agent未绑定模型" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 获取 Agent Skill 信息
    const agentSkills = await getAgentSkillsInfo(agent.id);

    // 加载 Skill 到沙盒
    let skillPresetPrompt = "";
    if (isSandboxEnabled() && agentSkills.length > 0) {
      const skillResult = await loadSkillsToSandbox(
        userId,
        agent.id,
        updatedMessage.conversation_id
      );
      if (skillResult.success) {
        skillPresetPrompt = skillResult.presetPrompt;
      }
    }

    // 构建系统提示词
    let systemPrompt = agent.system_prompt || "你是一个有帮助的AI助手。";
    if (skillPresetPrompt) {
      systemPrompt = `${systemPrompt}\n\n${skillPresetPrompt}`;
    }

    // 创建沙盒工具
    const sandboxTools = getSandboxToolsWithContext({
      conversationId: updatedMessage.conversation_id,
      userId: userId,
    });

    let runtimeTools: ToolSet = sandboxTools;
    let mcpRuntimeCleanup: (() => Promise<void>) | null = null;

    try {
      const mcpRuntime = await createAgentMcpRuntimeTools({
        agentId: agent.id,
        agentOwnerUserId: agent.user_id,
      });
      mcpRuntimeCleanup = mcpRuntime.cleanup;
      runtimeTools = mergeAgentToolSets({
        systemTools: sandboxTools,
        mcpTools: mcpRuntime.tools,
      });
    } catch (mcpBuildError) {
      console.error("构建MCP运行时工具失败:", mcpBuildError);
    }

    const safeCleanupMcpRuntime = async () => {
      if (!mcpRuntimeCleanup) return;
      try {
        await mcpRuntimeCleanup();
      } catch (cleanupError) {
        console.warn("MCP运行时清理失败:", cleanupError);
      }
    };

    // 获取模型上下文上限
    const contextLimit = userModel?.context_limit ?? 32000;

    // ==================== 检查并执行未处理的压缩任务 ====================
    // 注意：压缩执行在加载历史消息之前
    const pendingTask = await getPendingCompressionTask(updatedMessage.conversation_id);

    if (pendingTask) {
      try {
        // 执行压缩
        const { removedCount } = await executeCompressionTask(updatedMessage.conversation_id);
        // 标记任务完成
        await completeCompressionTask(pendingTask.id);
        console.log("[edit-regenerate 压缩执行] 完成:", { taskId: pendingTask.id, removedCount });
      } catch (error) {
        // 压缩失败不影响请求继续
        console.error("[edit-regenerate 压缩执行] 失败:", error);
      }
    }

    // ==================== 加载历史消息 ====================
    // 使用统一的加载逻辑（与压缩执行时一致）
    const historyMessages = await loadHistoryMessages(updatedMessage.conversation_id);

    // 转换消息格式
    const modelMessages = await convertToModelMessages(historyMessages, {
      ignoreIncompleteToolCalls: true,
    });

    // 包装模型（包含压缩检测中间件）
    const wrappedModel = wrapModelWithAllMiddlewares(chatModel, {
      conversationId: updatedMessage.conversation_id,
      contextLimit,
    });

    // 创建 Agent 实例
    const agentInstance = new ToolLoopAgent({
      model: wrappedModel,
      instructions: systemPrompt,
      tools: runtimeTools,
      stopWhen: stepCountIs(10),
    });

    // 执行流式响应
    const result = await agentInstance.stream({
      messages: modelMessages,
    });

    // ==================== 响应流式输出 ====================
    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
      // 传递 usage 信息到客户端（用于 Context 组件显示 token 用量）
      messageMetadata: ({ part }) => {
        if (part.type === 'finish') {
          return {
            usage: part.totalUsage,
            contextLimit,
            modelName,
          };
        }
        return undefined;
      },
      onFinish: async ({ responseMessage, finishReason }) => {
        try {
          if (finishReason !== "error") {
            try {
              const respMessageId = nanoid();
              const parts = responseMessage?.parts || [];

              const fullMessage: UIMessage = {
                id: respMessageId,
                role: "assistant",
                parts,
              };

              // 获取完整的 usage（所有 step 的累加）
              const usage = await result.totalUsage;

              // 持久化 assistant 消息（带 token 统计）
              await createMessage({
                id: respMessageId,
                conversationId: updatedMessage.conversation_id,
                role: "assistant",
                content: JSON.stringify(fullMessage),
                // 保存 token 统计
                input_tokens: usage?.inputTokens,
                output_tokens: usage?.outputTokens,
                total_tokens: usage?.totalTokens,
              });

              // 更新对话的 token 汇总
              if (usage) {
                await updateConversationTokenTotals(updatedMessage.conversation_id, {
                  inputTokens: usage.inputTokens || 0,
                  outputTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                });
              }

              await touchConversation(updatedMessage.conversation_id);
            } catch (saveError) {
              console.error("保存消息失败:", saveError);
            }
          }
        } finally {
          await safeCleanupMcpRuntime();
        }
      },
    });
  } catch (error) {
    console.error("编辑重发失败:", error);

    const errorMessage = error instanceof Error ? error.message : "服务器内部错误";

    if (errorMessage === "消息不存在" || errorMessage === "对话不存在") {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage === "只能编辑用户消息") {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage === "无权操作此消息") {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "服务器内部错误" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}