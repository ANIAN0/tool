/**
 * Agent对话API
 * 使用数据库中的Agent配置进行对话
 *
 * 请求格式：
 * POST /api/agent-chat
 * Headers: X-User-Id
 * Body: { messages: UIMessage[], conversationId?: string, agentId: string }
 *
 * 响应格式：
 * 流式响应（使用 toUIMessageStreamResponse）
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  UIMessage,
} from "ai";
import type { ToolSet, StepResult } from "ai";
import {
  createConversation,
  createMessage,
  getConversation,
  touchConversation,
  getAgentById,
  getUserModelById,
  getDefaultUserModel,
  type UserModel,
} from "@/lib/db";
import { nanoid } from "nanoid";
import { wrapModelWithDevTools } from "@/lib/ai";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getSandboxToolsWithContext } from "@/lib/sandbox";
import { decryptApiKey } from "@/lib/encryption";
import {
  createAgentMcpRuntimeTools,
  type McpRuntimeDiagnostic,
} from "@/lib/agents/mcp-runtime";
import { mergeAgentToolSets } from "@/lib/agents/toolset-merge";

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
 * 从Agent的steps构建UIMessage parts
 * 包括文本、工具调用和步骤分隔符
 */
function buildPartsFromSteps<TOOLS extends ToolSet>(steps: StepResult<TOOLS>[]): UIMessage["parts"] {
  const parts: UIMessage["parts"] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // 添加步骤分隔符（从第二个步骤开始）
    if (i > 0) {
      parts.push({ type: "step-start" });
    }

    // 添加文本内容
    if (step.text) {
      parts.push({ type: "text", text: step.text });
    }

    // 添加工具调用
    for (const toolCall of step.toolCalls) {
      const isDynamic = "dynamic" in toolCall && toolCall.dynamic;

      // 查找对应的工具结果
      const toolCallId = (toolCall as { toolCallId: string }).toolCallId;
      const result = step.toolResults.find(
        (r) => {
          const rId = (r as { toolCallId?: string }).toolCallId;
          return rId === toolCallId;
        }
      );

      // 获取工具名称
      const toolName = (toolCall as { toolName: string }).toolName;
      const input = (toolCall as { input: unknown }).input;

      // 确定工具状态
      let state: "input-streaming" | "input-available" | "output-available" | "output-error" = "input-available";
      let output: unknown = undefined;
      let errorText: string | undefined = undefined;

      if (result) {
        const resultOutput = (result as { output?: unknown; error?: unknown }).output;
        const resultError = (result as { output?: unknown; error?: unknown }).error;

        if (resultError) {
          state = "output-error";
          errorText = String(resultError);
        } else {
          state = "output-available";
          output = resultOutput;
        }
      }

      if (isDynamic) {
        parts.push({
          type: "dynamic-tool",
          toolName,
          toolCallId,
          input,
          output,
          state,
          errorText,
        } as UIMessage["parts"][number]);
      } else {
        parts.push({
          type: `tool-${toolName}` as `tool-${string}`,
          toolCallId,
          input,
          output,
          state,
          errorText,
        } as UIMessage["parts"][number]);
      }
    }
  }

  return parts;
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
 * 统计 MCP 运行时诊断摘要（按 code 聚合）
 */
function buildDiagnosticsSummary(
  diagnostics: McpRuntimeDiagnostic[]
): Record<string, number> {
  // 预置所有诊断码，保证日志结构稳定可解析
  const summary: Record<string, number> = {
    SERVER_DISABLED: 0,
    SERVER_CONNECT_FAILED: 0,
    REMOTE_TOOLS_FETCH_FAILED: 0,
    TOOL_NOT_FOUND_ON_SERVER: 0,
    TOOL_MAPPED: 0,
  };
  // 按诊断码累加计数
  for (const diagnostic of diagnostics) {
    summary[diagnostic.code] = (summary[diagnostic.code] ?? 0) + 1;
  }
  // 返回聚合结果
  return summary;
}

/**
 * Agent对话API路由
 */
export async function POST(req: Request) {
  try {
    // 解析请求体
    const body = await req.json();
    const { messages, conversationId, agentId } = body as {
      messages: UIMessage[];
      conversationId?: string;
      agentId: string;
    };

    // 验证消息不为空
    if (!messages || messages.length === 0) {
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

    // 获取用户ID
    const userId = req.headers.get("X-User-Id");
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "用户ID不能为空" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

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

    if (agent.model_id) {
      // 优先使用 Agent 绑定模型（使用创建者的模型池）
      const modelConfig = await getUserModelById(agent.user_id, agent.model_id);
      if (!modelConfig) {
        return new Response(
          JSON.stringify({ error: "Agent关联的模型不存在" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

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
      // Agent 未绑定模型时，必须使用当前用户默认模型
      const defaultModel = await getDefaultUserModel(userId);
      if (!defaultModel) {
        return new Response(
          JSON.stringify({
            error: "请先在设置页配置并设为默认模型（OpenAI-Compatible）",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

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

    // 包装模型（开发环境启用 DevTools）
    const wrappedModel = wrapModelWithDevTools(chatModel);

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
        // 对话不存在，创建新对话
        const firstUserMessage = messages.find((m) => m.role === "user");
        const title = firstUserMessage
          ? extractTitle(
              firstUserMessage.parts
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

    // 存储用户消息
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      const userMessageId = lastMessage.id || nanoid();
      const fullUserMessage: UIMessage = {
        id: userMessageId,
        role: "user",
        parts: lastMessage.parts,
      };

      await createMessage({
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: JSON.stringify(fullUserMessage),
      });
    }

    // 转换消息格式
    const modelMessages = await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    });

    // 创建沙盒工具（绑定会话上下文）
    const sandboxTools = getSandboxToolsWithContext({
      conversationId: currentConversationId!,
      userId: userId,
    });

    // 初始化运行时工具集合，默认仅包含系统工具（sandbox）
    let runtimeTools: ToolSet = sandboxTools;
    // 初始化 MCP 运行时清理函数，用于请求结束统一释放连接
    let mcpRuntimeCleanup: (() => Promise<void>) | null = null;
    // 初始化诊断明细，用于日志可观测性
    let mcpDiagnostics: McpRuntimeDiagnostic[] = [];
    // 初始化 MCP 已映射工具数量（用于摘要日志）
    let mcpMappedToolCount = 0;

    try {
      // 按 Agent 绑定关系构建 MCP 运行时工具（best-effort）
      const mcpRuntime = await createAgentMcpRuntimeTools({
        agentId: agent.id,
        agentOwnerUserId: agent.user_id,
      });
      // 保存 MCP 清理函数，后续在流式结束时关闭客户端
      mcpRuntimeCleanup = mcpRuntime.cleanup;
      // 保存诊断明细，后续用于聚合日志与问题定位
      mcpDiagnostics = mcpRuntime.diagnostics;
      // 记录 MCP 映射工具数，便于运行时挂载可观测
      mcpMappedToolCount = Object.keys(mcpRuntime.tools).length;
      // 合并系统工具与 MCP 工具，保持系统工具优先
      runtimeTools = mergeAgentToolSets({
        systemTools: sandboxTools,
        mcpTools: mcpRuntime.tools,
      });
    } catch (mcpBuildError) {
      // MCP 构建失败时降级为仅系统工具，不阻断整次对话
      console.error("构建Agent MCP运行时工具失败，已降级为仅系统工具:", mcpBuildError);
    }

    // 统计诊断码摘要，便于快速观察挂载质量
    const diagnosticsSummary = buildDiagnosticsSummary(mcpDiagnostics);
    // 提取可定位的诊断明细，满足“服务/工具级”排障要求
    const diagnosticsDetails = mcpDiagnostics.map((diagnostic) => {
      const context = diagnostic.context ?? {};
      return {
        code: diagnostic.code,
        serverId:
          typeof context.serverId === "string" ? context.serverId : undefined,
        serverName:
          typeof context.serverName === "string"
            ? context.serverName
            : undefined,
        toolName:
          typeof context.toolName === "string"
            ? context.toolName
            : typeof context.sourceToolName === "string"
            ? context.sourceToolName
            : undefined,
        message: diagnostic.message,
      };
    });
    // 计算 MCP 相关 server 数量，辅助判断是否完全未挂载
    const mcpServerCount = new Set(
      diagnosticsDetails
        .map((detail) => detail.serverId)
        .filter((serverId): serverId is string => Boolean(serverId))
    ).size;

    // 输出结构化摘要日志（用于线上排障与验收核对）
    console.log(
      "Agent MCP运行时挂载摘要:",
      JSON.stringify({
        agentId: agent.id,
        conversationId: currentConversationId,
        mcpServerCount,
        mcpMappedToolCount,
        diagnosticsSummary,
        diagnosticsDetails,
      })
    );

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

    // 创建ToolLoopAgent实例
    const systemPrompt = agent.system_prompt || "你是一个有帮助的AI助手。";
    const agentInstance = new ToolLoopAgent({
      model: wrappedModel,
      instructions: systemPrompt,
      tools: runtimeTools, // 挂载“系统工具 + MCP工具”的合并结果
      stopWhen: stepCountIs(10),
    });

    // 执行流式响应
    const result = await (async () => {
      try {
        // 启动流式执行，正常结束时写入消息并回收 MCP 连接
        return await agentInstance.stream({
          messages: modelMessages,
          onFinish: async ({ text, finishReason, steps }) => {
            try {
              if (finishReason !== "error") {
                try {
                  // 生成 assistant 消息ID
                  const messageId = nanoid();
                  // 优先使用 steps 还原工具调用与文本片段
                  const parts =
                    steps.length > 0
                      ? buildPartsFromSteps(steps)
                      : [{ type: "text" as const, text }];

                  // 组装完整 assistant 消息对象
                  const fullMessage: UIMessage = {
                    id: messageId,
                    role: "assistant",
                    parts,
                  };

                  // 持久化 assistant 消息
                  await createMessage({
                    id: messageId,
                    conversationId: currentConversationId!,
                    role: "assistant",
                    content: JSON.stringify(fullMessage),
                  });

                  // 刷新会话更新时间
                  await touchConversation(currentConversationId!);
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
      } catch (streamError) {
        // 启动流式过程失败时也要执行清理，避免连接泄漏
        await safeCleanupMcpRuntime();
        throw streamError;
      }
    })();

    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });
  } catch (error) {
    console.error("Agent对话API错误:", error);

    return new Response(
      JSON.stringify({ error: "服务器内部错误" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}