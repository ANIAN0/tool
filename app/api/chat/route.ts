import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  streamText,
  UIMessage,
} from "ai";
import {
  createConversation,
  createMessage,
  getConversation,
  touchConversation,
} from "@/lib/db";
import { nanoid } from "nanoid";
import { wrapModelWithDevTools } from "@/lib/ai";

// 创建 OpenRouter provider 实例
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// 默认模型（免费模型）
const DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free";

// 设置最大响应时间为 60 秒
export const maxDuration = 60;

/**
 * 聊天 API 路由
 * 处理聊天请求，调用 OpenRouter API，返回流式响应
 * 
 * 请求格式：
 * POST /api/chat
 * Body: { messages: UIMessage[], conversationId?: string, model?: string }
 * 
 * 响应格式：
 * 流式响应（使用 toUIMessageStreamResponse）
 */
export async function POST(req: Request) {
  try {
    // 解析请求体
    const body = await req.json();
    const { messages, conversationId, model } = body as {
      messages: UIMessage[];
      conversationId?: string;
      model?: string;
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

    // 确定对话ID
    let currentConversationId = conversationId;

    // 如果没有对话ID，创建新对话
    if (!currentConversationId) {
      currentConversationId = nanoid();
      
      // 从第一条用户消息生成对话标题
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
      });
    } else {
      // 验证对话存在且属于当前用户
      const conversation = await getConversation(currentConversationId);
      if (!conversation) {
        return new Response(
          JSON.stringify({ error: "对话不存在" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      if (conversation.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "无权访问此对话" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 存储用户消息（只存储最后一条，因为前面的消息已经在历史记录中）
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      const userContent = lastMessage.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("");

      if (userContent) {
        await createMessage({
          id: lastMessage.id || nanoid(),
          conversationId: currentConversationId,
          role: "user",
          content: userContent,
        });
      }
    }

    // 转换消息格式供模型使用
    const modelMessages = await convertToModelMessages(messages);

    // 调用 OpenRouter API 进行流式响应
    const result = streamText({
      model: wrappedModel,
      messages: modelMessages,
      onFinish: async ({ text, finishReason }) => {
        // AI 回复完成后存储消息
        if (text && finishReason !== "error") {
          await createMessage({
            id: nanoid(),
            conversationId: currentConversationId!,
            role: "assistant",
            content: text,
          });

          // 更新对话时间戳
          await touchConversation(currentConversationId!);
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
