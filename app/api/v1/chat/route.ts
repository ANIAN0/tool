/**
 * 对外对话接口
 * POST /api/v1/chat
 * 使用 API Key 鉴权的流式对话接口
 *
 * 请求格式：
 * Body: { message: UIMessage, conversationId?: string, agentId: string }
 */

import { convertToModelMessages, UIMessage } from "ai";
import type { ToolSet } from "ai";
import { nanoid } from "nanoid";
import {
  getConversation,
  getAgentById,
  getUserModelById,
  getDefaultUserModel,
  type UserModel,
} from "@/lib/db";
// 压缩相关函数（异步压缩方案）
import {
  getPendingCompressionTask,
  completeCompressionTask,
  loadHistoryMessages,
  executeCompressionTask,
} from "@/lib/db/compression";
import { createModel } from "@/lib/infra/model";
import { createChatSessionService } from "@/lib/infra/session";
import { createMessageService } from "@/lib/infra/message";
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/infra/user/api-key";
import { ToolLoopAgent, stepCountIs } from "ai";
import { createSandboxTools, loadSkillsToSandbox, isSandboxEnabled } from "@/lib/infra/sandbox";
import { mergeAgentToolSets } from "@/lib/agents/toolset-merge";
import { createMcpRuntime } from "@/lib/infra/mcp";
import { getAgentMcpRuntimeToolConfigs, getAgentSkillsInfo } from "@/lib/db/agents";

// 服务实例（需要在所有导入之后创建）
const sessionService = createChatSessionService();
const messageService = createMessageService();

// 设置最大响应时间为 60 秒
export const maxDuration = 60;

/**
 * 从消息内容提取对话标题
 */
function extractTitle(content: string): string {
  if (!content) return "新对话";
  const title = content.replace(/\n/g, " ").slice(0, 50);
  return title.length < content.length ? `${title}...` : title;
}

/**
 * 对外对话 API
 */
export async function POST(request: Request) {
  // 验证 API Key
  const authResult = await authenticateApiKey(request as any);
  if (!authResult.success) {
    return apiKeyErrorResponse(authResult);
  }

  const userId = authResult.userId;

  try {
    // 解析请求体（前端只发送最后一条消息）
    const body = await request.json();
    const { message, conversationId, agentId } = body as {
      message: UIMessage;      // 单条新消息（前端只发送最后一条）
      conversationId?: string;
      agentId: string;
    };

    // 验证参数
    if (!message) {
      return new Response(
        JSON.stringify({ error: "消息不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId 不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 🚀 性能优化：Early-start pattern - 提前启动独立 Promise
    // 1. 提前启动默认模型查询
    const defaultModelPromise = getDefaultUserModel(userId);
    // 2. 提前启动 Skills 信息查询（只需要 agentId）
    const agentSkillsPromise = getAgentSkillsInfo(agentId);
    // 3. 如果提供了 conversationId，提前启动会话查询
    const conversationPromise = conversationId ? getConversation(conversationId) : null;

    // 获取 Agent 配置
    const agent = await getAgentById(agentId, userId);
    if (!agent) {
      return new Response(
        JSON.stringify({ error: "Agent 不存在或无权访问" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 获取或创建会话
    let currentConversationId = conversationId;

    // 如果提供了 conversationId，验证会话权限
    if (currentConversationId) {
      // 🚀 性能优化：使用提前启动的 conversationPromise（可能已在 agent 查询期间完成）
      const existingConversation = await conversationPromise;
      // 会话不存在，返回 404
      if (!existingConversation) {
        return new Response(
          JSON.stringify({ error: { code: "NOT_FOUND", message: "会话不存在" } }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      // 会话不属于当前用户，返回 403
      if (existingConversation.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: { code: "FORBIDDEN", message: "无权访问该会话" } }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 如果没有提供 conversationId，创建新会话
    if (!currentConversationId) {
      const content = message?.parts?.find((p) => p.type === "text")?.text || "";
      const session = await sessionService.create({
        id: nanoid(),
        userId,
        title: extractTitle(content),
        agentId,
        source: "api-v1",
      });
      currentConversationId = session.id;
    }

    // 获取用户模型配置
    let userModel: UserModel | null = null;
    if (agent.model_id) {
      userModel = await getUserModelById(userId, agent.model_id);
    }
    // 🚀 性能优化：使用提前启动的 defaultModelPromise（可能已在之前操作期间完成）
    if (!userModel) {
      userModel = await defaultModelPromise;
    }
    if (!userModel) {
      return new Response(
        JSON.stringify({ error: "请先配置模型" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 获取模型上下文上限
    const contextLimit = userModel?.context_limit ?? 32000;

    // 创建模型实例（ModelService 内部已包装 DevTools）
    const modelResult = await createModel({
      modelId: userModel!.id,
      userId,
    });
    // 直接使用模型，跳过外部包装（避免重复包装）
    const wrappedModel = modelResult.model;

    // 🚀 性能优化：等待提前启动的 Skills Promise 完成（可能已在之前操作期间完成）
    const agentSkills = await agentSkillsPromise;

    // 加载 Skill 到沙盒
    let skillPresetPrompt = "";
    if (isSandboxEnabled() && agentSkills.length > 0) {
      const skillResult = await loadSkillsToSandbox(userId, agentId, currentConversationId!);
      if (skillResult.success) {
        skillPresetPrompt = skillResult.presetPrompt;
      }
    }

    // 构建系统提示词
    let systemPrompt = agent.system_prompt || "你是一个有帮助的AI助手。";
    if (skillPresetPrompt) {
      systemPrompt = `${systemPrompt}\n\n${skillPresetPrompt}`;
    }

    // 创建运行时工具（无参数版本，execute 函数通过 experimental_context 获取沙盒实例）
    const sandboxTools = isSandboxEnabled()
      ? createSandboxTools()
      : {};

    // 获取 MCP 运行时工具（使用新服务）
    let mcpRuntimeCleanup: (() => Promise<void>) | null = null;
    let mcpTools: ToolSet = {};

    try {
      // 查询 Agent 绑定的 MCP 工具配置
      const mcpToolConfigs = await getAgentMcpRuntimeToolConfigs(agent.id, agent.user_id);
      
      if (mcpToolConfigs.length > 0) {
        // 转换为 MCP 运行时配置
        const serversMap = new Map<string, { id: string; name: string; url: string; headers: Record<string, string>; enabled: boolean }>();
        const toolsList: Array<{ serverId: string; toolName: string }> = [];
        
        for (const config of mcpToolConfigs) {
          if (!serversMap.has(config.serverId)) {
            serversMap.set(config.serverId, {
              id: config.serverId,
              name: config.serverName,
              url: config.serverUrl,
              headers: config.serverHeaders,
              enabled: config.serverEnabled,
            });
          }
          toolsList.push({
            serverId: config.serverId,
            toolName: config.toolName,
          });
        }
        
        const mcpRuntime = await createMcpRuntime({
          servers: Array.from(serversMap.values()),
          tools: toolsList,
        });
        
        mcpRuntimeCleanup = mcpRuntime.cleanup;
        mcpTools = mcpRuntime.tools;
      }
    } catch (mcpBuildError) {
      console.error("构建 MCP 运行时工具失败，已降级为仅系统工具:", mcpBuildError);
    }

    // 合并工具集
    const runtimeTools = mergeAgentToolSets({
      systemTools: sandboxTools,
      mcpTools: mcpTools,
    });

    // 定义统一清理函数，确保 MCP 连接在请求结束后释放
    const safeCleanupMcpRuntime = async () => {
      if (!mcpRuntimeCleanup) return;
      try {
        await mcpRuntimeCleanup();
      } catch (cleanupError) {
        console.warn("MCP 运行时清理失败:", cleanupError);
      }
    };

    // ==================== 检查并执行未处理的压缩任务 ====================
    // 注意：压缩执行在用户消息保存之前

    const pendingTask = await getPendingCompressionTask(currentConversationId!);

    if (pendingTask) {
      try {
        // 执行压缩（使用统一的加载历史消息逻辑）
        const { removedCount } = await executeCompressionTask(currentConversationId!);

        // 标记任务完成（无论是否实际压缩，都标记完成，避免死循环）
        await completeCompressionTask(pendingTask.id);

        console.log("[v1/chat 压缩执行] 完成:", { taskId: pendingTask.id, removedCount });
      } catch (error) {
        // 压缩失败：任务状态不变（pending），下次重试
        // 不影响本次请求，继续执行
        console.error("[v1/chat 压缩执行] 失败:", error);
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

      await messageService.create({
        id: userMessageId,
        conversationId: currentConversationId!,
        role: "user",
        content: JSON.stringify(fullUserMessage),
      });
    }

    // 合并历史消息和当前新消息
    const messagesForLLM = [...historyMessages, message];

    // 转换消息格式
    const modelMessages = await convertToModelMessages(messagesForLLM, {
      ignoreIncompleteToolCalls: true,
    });

    // 创建 Agent 实例，传入 experimental_context 供沙盒工具获取会话信息
    const agentInstance = new ToolLoopAgent({
      model: wrappedModel,
      instructions: systemPrompt,
      tools: runtimeTools,
      stopWhen: stepCountIs(10),
      experimental_context: {
        getSandbox: () => ({
          sessionId: currentConversationId!,
          userId,
        }),
      },
    });

    // 流式执行（压缩检测通过 middleware 闭包传入）
    const streamResult = await agentInstance.stream({
      messages: modelMessages,
    });

    // 消费流以确保即使客户端断开，服务端也会完成生成
    streamResult.consumeStream(); // 无需 await，后台执行

    // 更新会话时间戳
    await sessionService.touch(currentConversationId!);

    // 返回流式响应
    const modelName = userModel?.model ?? "";

    return streamResult.toUIMessageStreamResponse({
      headers: {
        "X-Conversation-Id": currentConversationId!,
      },
      sendSources: true,
      sendReasoning: true,
      // 传递 usage 信息到客户端
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
          if (finishReason !== "error" && currentConversationId) {
            try {
              const usage = await streamResult.totalUsage;
              const messageId = nanoid();
              const parts = responseMessage?.parts || [];

              const fullMessage: UIMessage = {
                id: messageId,
                role: "assistant",
                parts,
              };

              await messageService.create({
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
                await sessionService.updateTokenTotals(currentConversationId, {
                  inputTokens: usage.inputTokens || 0,
                  outputTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                });
              }

              await sessionService.touch(currentConversationId);
            } catch (saveError) {
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
    console.error("对话 API 错误:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "服务器内部错误",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}