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

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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
} from "@/lib/db";
import { nanoid } from "nanoid";
import { wrapModelWithDevTools } from "@/lib/ai";
import { ToolLoopAgent, stepCountIs } from "ai";

// 创建 OpenRouter provider 实例
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// 默认模型（免费模型）
const DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free";

// 设置最大响应时间为 60 秒
export const maxDuration = 60;

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
    let modelName = DEFAULT_MODEL;
    let chatModel;

    if (agent.model_id) {
      // 使用Agent关联的模型
      const modelConfig = await getUserModelById(agent.user_id, agent.model_id);
      if (!modelConfig) {
        return new Response(
          JSON.stringify({ error: "Agent关联的模型不存在" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // 使用创建者的模型配置
      if (modelConfig.provider === "openrouter") {
        const agentOpenrouter = createOpenRouter({
          apiKey: modelConfig.api_key,
        });
        chatModel = agentOpenrouter.chat(modelConfig.model);
      } else {
        // 其他provider待实现
        return new Response(
          JSON.stringify({ error: "暂不支持的模型提供商" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      modelName = modelConfig.model;
    } else {
      // Agent未配置模型，使用用户默认模型
      const defaultModel = await getDefaultUserModel(userId);
      if (defaultModel) {
        if (defaultModel.provider === "openrouter") {
          const userOpenrouter = createOpenRouter({
            apiKey: defaultModel.api_key,
          });
          chatModel = userOpenrouter.chat(defaultModel.model);
          modelName = defaultModel.model;
        } else {
          chatModel = openrouter.chat(DEFAULT_MODEL);
        }
      } else {
        // 使用默认OpenRouter模型
        chatModel = openrouter.chat(DEFAULT_MODEL);
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

    // TODO: 创建工具（如果Agent有关联的工具）
    // 目前暂不支持工具调用，后续实现
    // if (agent.tools && agent.tools.length > 0) {
    //   const toolsResult = await createToolsFromMcpTools(agent.tools);
    //   tools = toolsResult.tools;
    //   cleanup = toolsResult.cleanup;
    // }

    // 创建ToolLoopAgent实例
    const systemPrompt = agent.system_prompt || "你是一个有帮助的AI助手。";
    const agentInstance = new ToolLoopAgent({
      model: wrappedModel,
      instructions: systemPrompt,
      stopWhen: stepCountIs(10),
    });

    // 执行流式响应
    const result = await agentInstance.stream({
      messages: modelMessages,
      onFinish: async ({ text, finishReason, steps }) => {
        if (finishReason !== "error") {
          try {
            const messageId = nanoid();
            const parts = steps.length > 0 ? buildPartsFromSteps(steps) : [{ type: "text" as const, text }];

            const fullMessage: UIMessage = {
              id: messageId,
              role: "assistant",
              parts,
            };

            await createMessage({
              id: messageId,
              conversationId: currentConversationId!,
              role: "assistant",
              content: JSON.stringify(fullMessage),
            });

            await touchConversation(currentConversationId!);
          } catch (saveError) {
            console.error("保存消息失败:", saveError);
          }
        }
      },
    });

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