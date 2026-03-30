/**
 * 对外对话接口
 * POST /api/v1/chat
 * 使用 API Key 鉴权的流式对话接口
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, UIMessage } from "ai";
import type { ToolSet } from "ai";
import { nanoid } from "nanoid";
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
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/auth/api-key-middleware";
import { decryptApiKey } from "@/lib/encryption";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getSandboxToolsWithContext } from "@/lib/sandbox";
import { loadSkillsToSandbox } from "@/lib/sandbox/skill-loader";
import { isSandboxEnabled } from "@/lib/sandbox/config";
import {
  createAgentMcpRuntimeTools,
} from "@/lib/agents/mcp-runtime";
import { mergeAgentToolSets } from "@/lib/agents/toolset-merge";

// 设置最大响应时间为 60 秒
export const maxDuration = 60;

/**
 * 根据用户模型配置构建聊天模型
 */
function buildChatModelFromUserModel(userModel: UserModel) {
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
    // 解析请求体
    const body = await request.json();
    const { messages, conversationId, agentId } = body as {
      messages: UIMessage[];
      conversationId?: string;
      agentId: string;
    };

    // 验证参数
    if (!messages || messages.length === 0) {
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
      // 查询会话是否存在
      const existingConversation = await getConversation(currentConversationId);
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
      const userMessage = messages[messages.length - 1];
      const content = userMessage?.parts?.find((p) => p.type === "text")?.text || "";
      const newConversation = await createConversation({
        id: nanoid(),
        userId,
        title: extractTitle(content),
        agentId,
        source: "api-v1",
      });
      currentConversationId = newConversation.id;
    }

    // 获取用户模型配置
    let userModel: UserModel | null = null;
    if (agent.model_id) {
      userModel = await getUserModelById(userId, agent.model_id);
    }
    if (!userModel) {
      userModel = await getDefaultUserModel(userId);
    }
    if (!userModel) {
      return new Response(
        JSON.stringify({ error: "请先配置模型" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 构建聊天模型
    const baseModel = buildChatModelFromUserModel(userModel);
    const wrappedModel = baseModel;

    // 转换消息格式
    const modelMessages = await convertToModelMessages(messages);

    // 获取 Agent 关联的 Skill 信息
    const agentSkills = await getAgentSkillsInfo(agentId);

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

    // 创建运行时工具
    const sandboxTools = isSandboxEnabled()
      ? await getSandboxToolsWithContext({
          conversationId: currentConversationId!,
          userId,
        })
      : {};

    // 获取 MCP 运行时工具
    const { tools: mcpTools } = await createAgentMcpRuntimeTools({
      agentId: agent.id,
      agentOwnerUserId: agent.user_id,
    });

    // 合并工具集
    const runtimeTools = mergeAgentToolSets({
      systemTools: sandboxTools,
      mcpTools: mcpTools,
    });

    // 创建 Agent 实例
    const agentInstance = new ToolLoopAgent({
      model: wrappedModel,
      instructions: systemPrompt,
      tools: runtimeTools,
      stopWhen: stepCountIs(10),
    });

    // 流式执行
    const streamResult = await agentInstance.stream({
      messages: modelMessages,
    });

    // 更新会话时间戳
    await touchConversation(currentConversationId!);

    // 返回流式响应
    return streamResult.toUIMessageStreamResponse({
      headers: {
        "X-Conversation-Id": currentConversationId!,
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

// 导入需要的函数
import { getAgentSkillsInfo } from "@/lib/db/agents";