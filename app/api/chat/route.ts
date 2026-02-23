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
} from "@/lib/db";
import { nanoid } from "nanoid";
import { wrapModelWithDevTools } from "@/lib/ai";
import { createAgent, DEFAULT_AGENT_ID, getAgentConfig } from "@/lib/agents";
import { isRegisteredUser } from "@/lib/auth/middleware";
import { retrieveMemories, memoryWorkflow } from "@/lib/memory";
import { buildSystemPromptWithMemory } from "@/lib/memory/prompt-builder";

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
        // 动态工具
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
        // 静态工具
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
 * 聊天 API 路由
 * 使用 ToolLoopAgent 处理聊天请求，支持自动工具调用循环
 * 
 * 请求格式：
 * POST /api/chat
 * Body: { messages: UIMessage[], conversationId?: string, model?: string, agentId?: string }
 * 
 * 响应格式：
 * 流式响应（使用 toUIMessageStreamResponse）
 */
export async function POST(req: Request) {
  // 清理函数引用（在创建 agent 后赋值）
  let cleanup: (() => Promise<void>) | null = null;
  
  try {
    // 解析请求体
    const body = await req.json();
    const { messages, conversationId, model, agentId } = body as {
      messages: UIMessage[];
      conversationId?: string;
      model?: string;
      agentId?: string;
    };

    // 验证消息不为空
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "消息不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 获取用户ID（从请求头获取，前端通过匿名ID传递）
    const userId = req.headers.get("X-User-Id");
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "用户ID不能为空" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 使用的模型
    const modelName = model || DEFAULT_MODEL;
    const chatModel = openrouter.chat(modelName);

    // 包装模型（开发环境启用 DevTools）
    const wrappedModel = wrapModelWithDevTools(chatModel);

    // 确定对话ID和Agent ID
    const currentConversationId = conversationId;
    let currentAgentId = agentId;

    // 检查对话是否存在
    if (currentConversationId) {
      const conversation = await getConversation(currentConversationId);
      
      if (conversation) {
        // 对话已存在，验证权限并使用已有对话
        if (conversation.user_id !== userId) {
          return new Response(
            JSON.stringify({ error: "无权访问此对话" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        // 使用对话关联的agentId
        currentAgentId = conversation.agent_id;
      } else {
        // 对话不存在（新对话），使用前端传来的ID创建对话
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
          agentId: currentAgentId || DEFAULT_AGENT_ID,
        });
      }
    } else {
      // 没有对话ID（不应该发生），返回错误
      return new Response(
        JSON.stringify({ error: "对话ID不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 检查私有Agent的访问权限
    const agentConfig = getAgentConfig(currentAgentId || DEFAULT_AGENT_ID);
    if (agentConfig.isPrivate) {
      // 私有Agent需要验证用户是否已登录（非匿名用户）
      const isRegistered = await isRegisteredUser(userId);
      if (!isRegistered) {
        return new Response(
          JSON.stringify({ error: "访问私有Agent需要登录" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 如果Agent启用了记忆功能，检索记忆并注入到系统提示词
    let systemPrompt = agentConfig.systemPrompt;
    if (agentConfig.enableMemory) {
      try {
        console.log('[Memory] 检索记忆...');
        const memories = await retrieveMemories({
          query: messages.map(m => m.parts.map(p => 'text' in p ? p.text : '').join('')).join(' '),
          userId,
          agentId: currentAgentId || DEFAULT_AGENT_ID,
          limit: 5,
        });
        
        if (memories.userGlobal.length > 0 || memories.agentGlobal.length > 0 || memories.interaction.length > 0) {
          console.log('[Memory] 找到记忆:', { 
            userGlobal: memories.userGlobal.length, 
            agentGlobal: memories.agentGlobal.length, 
            interaction: memories.interaction.length 
          });
          systemPrompt = buildSystemPromptWithMemory({
            basePrompt: agentConfig.systemPrompt,
            memories,
          });
        }
      } catch (error) {
        console.error('[Memory] 检索记忆失败:', error);
        // 记忆检索失败不影响聊天，继续使用基础提示词
      }
    }

    // 存储用户消息（只存储最后一条，因为前面的消息已经在历史记录中）
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      // 构建完整的用户消息结构
      const userMessageId = lastMessage.id || nanoid();
      const fullUserMessage: UIMessage = {
        id: userMessageId,
        role: "user",
        parts: lastMessage.parts,
      };
      
      // 保存完整消息为JSON
      await createMessage({
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: JSON.stringify(fullUserMessage),
      });
    }

    // 转换消息格式供模型使用
    // 添加 ignoreIncompleteToolCalls 选项，忽略不完整的工具调用
    const modelMessages = await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    });

    // 创建 Agent 实例（使用 ToolLoopAgent）
    const agentResult = await createAgent(
      currentAgentId || DEFAULT_AGENT_ID,
      wrappedModel,
      systemPrompt,
    );
    cleanup = agentResult.cleanup;

    // 使用 Agent 的 stream 方法进行流式响应
    const result = await agentResult.agent.stream({
      messages: modelMessages,
      onFinish: async ({ text, finishReason, steps }) => {
        // Agent 完成后存储消息
        if (finishReason !== "error") {
          try {
            // 构建完整的消息结构
            const messageId = nanoid();
            
            // 从steps构建parts
            const parts = steps.length > 0 ? buildPartsFromSteps(steps) : [{ type: "text" as const, text }];
            
            // 构建完整的UIMessage
            const fullMessage: UIMessage = {
              id: messageId,
              role: "assistant",
              parts,
            };
            
            // 保存完整消息为JSON
            await createMessage({
              id: messageId,
              conversationId: currentConversationId!,
              role: "assistant",
              content: JSON.stringify(fullMessage),
            });

            // 更新对话时间戳
            await touchConversation(currentConversationId!);

            // 如果Agent启用了记忆功能，异步触发记忆提取工作流
            // 不阻塞聊天响应，错误不会影响用户
            if (agentConfig.enableMemory) {
              // 获取用户消息内容（用于记忆提取）
              const userMessageText = lastMessage.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { type: "text"; text: string }).text)
                .join("");
              
              // 异步触发记忆提取（不等待结果）
              void memoryWorkflow({
                userMessage: userMessageText,
                assistantMessage: text,
                userId,
                agentId: currentAgentId || DEFAULT_AGENT_ID,
              }).then((result) => {
                console.log('[Memory] 记忆提取结果:', result.status, result.reason);
              }).catch((err) => {
                console.error('[Memory] 记忆提取失败:', err);
              });
            }
          } catch (saveError) {
            console.error("保存消息失败:", saveError);
          }
        }
        
        // 在 onFinish 中清理资源（MCP 客户端等）
        // 此时流式响应已完成，可以安全关闭连接
        if (cleanup) {
          try {
            await cleanup();
          } catch (cleanupError) {
            console.error("清理资源失败:", cleanupError);
          }
        }
      },
    });

    // 返回流式响应
    return result.toUIMessageStreamResponse({
      // 发送来源信息（用于支持带来源的模型）
      sendSources: true,
      // 发送推理过程（用于支持推理的模型）
      sendReasoning: true,
    });
  } catch (error) {
    console.error("聊天 API 错误:", error);
    
    // 发生错误时也需要清理资源（如果已创建 agent）
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error("清理资源失败:", cleanupError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: "服务器内部错误" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * 从消息内容提取对话标题
 * 截取前50个字符作为标题
 */
function extractTitle(content: string): string {
  if (!content) return "新对话";
  
  // 移除换行符，截取前50个字符
  const title = content.replace(/\n/g, " ").slice(0, 50);
  
  // 如果截断了，添加省略号
  return title.length < content.length ? `${title}...` : title;
}
