/**
 * Agent对话API
 * 使用数据库中的Agent配置进行对话
 *
 * 请求格式：
 * POST /api/agent-chat
 * Headers: Authorization (JWT) 或 X-Anonymous-Id
 * Body: { message: UIMessage, conversationId?: string, agentId: string }
 *
 * 响应格式：
 * 流式响应（使用 toUIMessageStreamResponse）
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  UIMessage,
} from "ai";
import type { ToolSet } from "ai";
import {
  createConversation,
  createMessage,
  getConversation,
  touchConversation,
  getAgentById,
  getUserModelById,
  getDefaultUserModel,
  updateConversationTokenTotals,
  type UserModel,
} from "@/lib/db";
// 新增：压缩相关函数（异步压缩方案）
import {
  getPendingCompressionTask,
  completeCompressionTask,
  loadHistoryMessages,
  executeCompressionTask,
} from "@/lib/db/compression";
import { wrapModelWithAllMiddlewares } from "@/lib/ai";
import { nanoid } from "nanoid";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getSandboxToolsWithContext } from "@/lib/sandbox";
import { decryptApiKey } from "@/lib/encryption";
import { createAgentMcpRuntimeTools } from "@/lib/agents/mcp-runtime";
import { mergeAgentToolSets } from "@/lib/agents/toolset-merge";
import { loadSkillsToSandbox } from "@/lib/sandbox/skill-loader";
import { isSandboxEnabled } from "@/lib/sandbox/config";
import { getAgentSkillsInfo } from "@/lib/db/agents";
import { authenticateRequestOptional } from "@/lib/auth/middleware";
import { NextRequest } from "next/server";

// 设置最大响应时间为 60 秒
export const maxDuration = 60;

/**
 * 根据用户模型配置构建聊天模型
 * 当前仅支持 provider=openai（OpenAI-Compatible 协议）
 */
function buildChatModelFromUserModel(userModel: UserModel) {
  // 校验 provider，确保与文档和前端能力一致
  if (userModel.provider !== "openai") {
    throw new Error("当前仅支持 OpenAI-Compatible（provider=openai）");
  }

  // 解密数据库中存储的密文 API Key
  const decryptedApiKey = decryptApiKey(userModel.api_key);
  // 使用用户填写的 base_url；未填写时回退到 OpenAI 官方端点
  const baseURL = userModel.base_url || "https://api.openai.com/v1";

  // 创建 OpenAI-Compatible provider
  const provider = createOpenAICompatible({
    name: "user-openai-compatible",
    baseURL,
    apiKey: decryptedApiKey,
  });

  // 返回具体聊天模型实例
  return provider.chatModel(userModel.model);
}

/**
 * 从消息内容提取对话标题
 */
function extractTitle(content: string): string {
  if (!content) return "新对话";
  const title = content.replace(/\n/g, " ").slice(0, 50);
  return title.length < content.length ? `${title}...` : title;
}

/**
 * Agent对话API路由
 */
export async function POST(req: NextRequest) {
  // 使用标准认证中间件验证用户身份
  const authResult = await authenticateRequestOptional(req);
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const userId = authResult.userId;

  try {
    // 解析请求体（前端只发送最后一条消息）
    const body = await req.json();
    const { message, conversationId, agentId } = body as {
      message: UIMessage;      // 单条新消息（前端只发送最后一条）
      conversationId?: string;
      agentId: string;
    };

    // 验证消息不为空
    if (!message) {
      return new Response(
        JSON.stringify({ error: "消息不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 验证Agent ID
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "Agent ID不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 🚀 性能优化：Early-start pattern - 提前启动独立 Promise
    // 1. 提前启动默认模型查询（如果 agent 未绑定模型将使用此结果）
    const defaultModelPromise = getDefaultUserModel(userId);
    // 2. 提前启动 Skills 信息查询（不依赖 agent 查询结果，只需要 agentId）
    const agentSkillsPromise = getAgentSkillsInfo(agentId);

    // 获取Agent配置（验证访问权限）
    const agent = await getAgentById(agentId, userId);
    if (!agent) {
      return new Response(
        JSON.stringify({ error: "Agent不存在或无权访问" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 验证访问权限
    // 公开Agent：所有人可用
    // 私有Agent：仅创建者可用
    if (!agent.is_public && agent.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "无权访问此Agent" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 获取模型配置
    let modelName = "";
    let chatModel;
    let userModel: UserModel | null = null; // 保存模型配置引用，用于获取 context_limit

    if (agent.model_id) {
      // 优先使用 Agent 绑定模型（使用创建者的模型池）
      const modelConfig = await getUserModelById(agent.user_id, agent.model_id);
      if (!modelConfig) {
        return new Response(
          JSON.stringify({ error: "Agent关联的模型不存在" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      userModel = modelConfig; // 保存模型配置

      try {
        // 按文档仅支持 openai provider，统一走 OpenAI-Compatible
        chatModel = buildChatModelFromUserModel(modelConfig);
        modelName = modelConfig.model;
      } catch (modelError) {
        return new Response(
          JSON.stringify({
            error:
              modelError instanceof Error
                ? modelError.message
                : "模型配置无效，请检查后重试",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // 🚀 性能优化：使用提前启动的 defaultModelPromise（可能已在 agent 查询期间完成）
      // Agent 未绑定模型时，必须使用当前用户默认模型
      const defaultModel = await defaultModelPromise;
      if (!defaultModel) {
        return new Response(
          JSON.stringify({
            error: "请先在设置页配置并设为默认模型（OpenAI-Compatible）",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      userModel = defaultModel; // 保存模型配置

      try {
        // 使用当前用户默认模型构建聊天模型
        chatModel = buildChatModelFromUserModel(defaultModel);
        modelName = defaultModel.model;
      } catch (modelError) {
        return new Response(
          JSON.stringify({
            error:
              modelError instanceof Error
                ? modelError.message
                : "默认模型配置无效，请重新设置默认模型",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 获取模型上下文上限（用于压缩检测）
    const contextLimit = userModel?.context_limit ?? 32000;

    // 确定对话ID
    const currentConversationId = conversationId;

    // 检查对话是否存在
    if (currentConversationId) {
      const conversation = await getConversation(currentConversationId);

      if (conversation) {
        // 对话已存在，验证权限
        if (conversation.user_id !== userId) {
          return new Response(
            JSON.stringify({ error: "无权访问此对话" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        // 对话不存在，创建新对话（前端只发送单条消息）
        const title = message.role === "user"
          ? extractTitle(
              message.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { type: "text"; text: string }).text)
                .join("")
            )
          : "新对话";

        await createConversation({
          id: currentConversationId,
          userId,
          title,
          model: modelName,
          agentId: agentId,
          source: "agent-chat", // 关键：标记为AgentChat对话
        });
      }
    } else {
      return new Response(
        JSON.stringify({ error: "对话ID不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 构建聊天模型（使用中间件包装，传入压缩检测配置）
    const baseModel = buildChatModelFromUserModel(userModel);
    const wrappedModel = wrapModelWithAllMiddlewares(baseModel, {
      conversationId: currentConversationId!,
      contextLimit,
    });

    // ==================== 检查并执行未处理的压缩任务 ====================
    // 注意：压缩执行在用户消息保存之前

    const pendingTask = await getPendingCompressionTask(currentConversationId!);

    if (pendingTask) {
      try {
        // 执行压缩（使用统一的加载历史消息逻辑）
        const { removedCount } = await executeCompressionTask(currentConversationId!);

        // 标记任务完成（无论是否实际压缩，都标记完成，避免死循环）
        await completeCompressionTask(pendingTask.id);

        console.log("[agent-chat 压缩执行] 完成:", { taskId: pendingTask.id, removedCount });
      } catch (error) {
        // 压缩失败：任务状态不变（pending），下次重试
        // 不影响本次请求，继续执行
        console.error("[agent-chat 压缩执行] 失败:", error);
      }
    }

    // ==================== 加载历史消息 ====================
    // 注意：在保存用户消息之前加载，避免重复包含当前消息
    const historyMessages = await loadHistoryMessages(currentConversationId!);

    // ==================== 保存用户消息 ====================
    // 前端传入的单条新消息
    if (message.role === "user") {
      const userMessageId = message.id || nanoid();
      const fullUserMessage: UIMessage = {
        id: userMessageId,
        role: "user",
        parts: message.parts,
      };

      await createMessage({
        id: userMessageId,
        conversationId: currentConversationId!,
        role: "user",
        content: JSON.stringify(fullUserMessage),
      });
    }

    // 合并历史消息和当前新消息
    const messagesForLLM = [...historyMessages, message];

    // 🚀 性能优化：等待提前启动的 Skills Promise 完成（可能已在之前操作期间完成）
    const agentSkills = await agentSkillsPromise;

    // 加载 Skill 到沙盒（如果沙盒启用且 Agent 有配置 Skill）
    let skillPresetPrompt = "";
    if (isSandboxEnabled() && agentSkills.length > 0) {
      const skillResult = await loadSkillsToSandbox(userId, agent.id, currentConversationId!);
      if (skillResult.success) {
        skillPresetPrompt = skillResult.presetPrompt;
      }
    }

    // 构建系统提示词（包含 Skill 预置提示词）
    let systemPrompt = agent.system_prompt || "你是一个有帮助的AI助手。";
    if (skillPresetPrompt) {
      systemPrompt = `${systemPrompt}\n\n${skillPresetPrompt}`;
    }

    // 创建沙盒工具（绑定会话上下文）
    const sandboxTools = getSandboxToolsWithContext({
      conversationId: currentConversationId!,
      userId: userId,
    });

    // 初始化运行时工具集合，默认仅包含系统工具（sandbox）
    let runtimeTools: ToolSet = sandboxTools;
    // 初始化 MCP 运行时清理函数，用于请求结束统一释放连接
    let mcpRuntimeCleanup: (() => Promise<void>) | null = null;

    try {
      // 按 Agent 绑定关系构建 MCP 运行时工具（best-effort）
      const mcpRuntime = await createAgentMcpRuntimeTools({
        agentId: agent.id,
        agentOwnerUserId: agent.user_id,
      });
      // 保存 MCP 清理函数，后续在流式结束时关闭客户端
      mcpRuntimeCleanup = mcpRuntime.cleanup;
      // 合并系统工具与 MCP 工具，保持系统工具优先
      runtimeTools = mergeAgentToolSets({
        systemTools: sandboxTools,
        mcpTools: mcpRuntime.tools,
      });
    } catch (mcpBuildError) {
      // MCP 构建失败时降级为仅系统工具，不阻断整次对话
      console.error("构建Agent MCP运行时工具失败，已降级为仅系统工具:", mcpBuildError);
    }

    // 定义统一清理函数，确保 MCP 连接在请求结束后释放
    const safeCleanupMcpRuntime = async () => {
      // 没有 MCP 清理函数时直接返回
      if (!mcpRuntimeCleanup) return;
      try {
        // 执行 MCP 客户端关闭流程
        await mcpRuntimeCleanup();
      } catch (cleanupError) {
        // 清理失败仅记录告警，不影响主响应
        console.warn("MCP运行时清理失败:", cleanupError);
      }
    };

    // 转换消息格式
    const modelMessages = await convertToModelMessages(messagesForLLM, {
      ignoreIncompleteToolCalls: true,
    });

    // 创建ToolLoopAgent实例（压缩检测通过 middleware 闭包传入）
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

    // 消费流以确保即使客户端断开，服务端也会完成生成
    result.consumeStream(); // 无需 await，后台执行

    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
      // 传递 usage 信息到客户端（用于 Context 组件显示 token 用量）
      messageMetadata: ({ part }) => {
        // 在 finish 事件时传递 totalUsage 和模型配置
        if (part.type === "finish") {
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
          if (finishReason !== "error" && currentConversationId) {
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
                conversationId: currentConversationId,
                role: "assistant",
                content: JSON.stringify(fullMessage),
                // 保存 token 统计
                input_tokens: usage?.inputTokens,
                output_tokens: usage?.outputTokens,
                total_tokens: usage?.totalTokens,
              });

              // 更新对话的 token 汇总
              if (usage) {
                await updateConversationTokenTotals(currentConversationId, {
                  inputTokens: usage.inputTokens || 0,
                  outputTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                });
              }

              // 刷新会话更新时间
              await touchConversation(currentConversationId);
            } catch (saveError) {
              // 消息落库失败只记录日志，不影响流式返回
              console.error("保存消息失败:", saveError);
            }
          }
        } finally {
          // 无论成功或失败都执行 MCP 客户端清理
          await safeCleanupMcpRuntime();
        }
      },
    });
  } catch (error) {
    console.error("Agent对话API错误:", error);

    return new Response(
      JSON.stringify({ error: "服务器内部错误" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}