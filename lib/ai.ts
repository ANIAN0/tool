import { wrapLanguageModel } from "ai";
import { nanoid } from "nanoid";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createCompressionTask } from "./db/compression";
import { estimateTokens } from "./chat/compression";
import type { LanguageModelV3Middleware, LanguageModelV3StreamPart, LanguageModelV3CallOptions } from "@ai-sdk/provider";

/**
 * 是否启用DevTools
 * 仅在开发环境下启用
 */
const isDevToolsEnabled = process.env.NODE_ENV === "development";

/**
 * 自定义日志中间件 - 打印完整的 LLM 入参
 * 用于调试 token 计算，验证 params.prompt 实际内容
 *
 * 注意：LanguageModelV3CallOptions 使用 prompt 字段（而不是 messages）
 * prompt 是 LanguageModelV3Prompt 类型，包含转换后的消息数组
 */
const logInputMiddleware: LanguageModelV3Middleware = {
  // 必须指定 specificationVersion
  specificationVersion: 'v3',

  // 非流式调用时拦截
  wrapGenerate: async ({ doGenerate, params }) => {
    // params.prompt 包含完整的消息数组（已转换为 LanguageModelV3Prompt 格式）
    // 打印完整的 prompt（JSON 序列化，方便查看结构）
    console.log("[middleware] wrapGenerate params.prompt:", JSON.stringify(params.prompt, null, 2));

    // 打印消息数量和工具数量
    const promptArray = params.prompt;
    console.log("[middleware] wrapGenerate 摘要:", {
      promptLength: promptArray?.length || 0,
      toolsCount: params.tools?.length || 0,
      toolChoice: params.toolChoice,
      maxOutputTokens: params.maxOutputTokens,
      temperature: params.temperature,
    });

    const result = await doGenerate();

    // 打印实际返回的 token 使用量（如果有）
    console.log("[middleware] wrapGenerate result.usage:", result.usage);

    return result;
  },

  // 流式调用时拦截
  wrapStream: async ({ doStream, params }) => {
    // 打印完整的 prompt（JSON 序列化）
    console.log("[middleware] wrapStream params.prompt:", JSON.stringify(params.prompt, null, 2));

    // 打印摘要
    const promptArray = params.prompt;
    console.log("[middleware] wrapStream 摘要:", {
      promptLength: promptArray?.length || 0,
      toolsCount: params.tools?.length || 0,
      toolChoice: params.toolChoice,
      maxOutputTokens: params.maxOutputTokens,
      temperature: params.temperature,
    });

    const { stream, ...rest } = await doStream();

    // 收集流式输出的 token 信息
    const transformStream = new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
      transform(chunk, controller) {
        // 拦截 finish 事件获取 token 统计
        if (chunk.type === 'finish') {
          console.log("[middleware] wrapStream finish chunk:", {
            type: chunk.type,
            usage: chunk.usage,
          });
        }
        controller.enqueue(chunk);
      },
      flush() {
        console.log("[middleware] wrapStream 完成");
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};

/**
 * 创建压缩检测中间件（工厂函数）
 * 在 LLM 调用前估算 token，超过阈值时创建压缩任务
 *
 * 由于 Agent.stream 不支持 providerOptions 参数，
 * 使用工厂函数在包装模型时传入元数据（闭包方式）
 *
 * @param options - 压缩检测配置
 * @param options.conversationId - 会话 ID
 * @param options.contextLimit - 模型上下文上限
 * @returns LanguageModelV3Middleware 实例
 */
export function createCompressionDetectionMiddleware(options: {
  conversationId: string;
  contextLimit: number;
}): LanguageModelV3Middleware {
  const { conversationId, contextLimit } = options;
  const triggerThreshold = Math.floor(contextLimit * 0.6);

  return {
    specificationVersion: 'v3',

    wrapStream: async ({ doStream, params }) => {
      // 估算 token
      const totalTokens = estimateTotalTokensFromParams(params);

      console.log("[压缩检测] Token估算:", {
        totalTokens,
        contextLimit,
        triggerThreshold,
        needCompress: totalTokens > triggerThreshold,
      });

      // 如果超限，尝试创建压缩任务
      if (totalTokens > triggerThreshold) {
        try {
          await createCompressionTask({
            id: nanoid(),
            conversationId,
          });
          console.log("[压缩检测] 已创建压缩任务:", { conversationId });
        } catch (error: unknown) {
          // 唯一约束冲突：已有未处理任务，忽略
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('UNIQUE') || errorMessage.includes('SQLITE_CONSTRAINT_UNIQUE')) {
            console.log("[压缩检测] 已有未处理任务，跳过创建");
          } else {
            console.error("[压缩检测] 创建任务失败:", error);
          }
        }
      }

      // 请求继续执行
      return doStream();
    },
  };
}

/**
 * 从 params 估算 token 总数
 * params.prompt 是 LanguageModelV3Prompt 类型，包含转换后的消息数组
 */
function estimateTotalTokensFromParams(params: LanguageModelV3CallOptions): number {
  let totalTokens = 0;

  // 估算 prompt（messages）
  if (params.prompt && Array.isArray(params.prompt)) {
    for (const msg of params.prompt) {
      // content 可能是 string 或数组
      if (typeof msg.content === 'string') {
        totalTokens += estimateTokens(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            totalTokens += estimateTokens(part.text);
          } else if (part.type === 'file') {
            // 图片文件大约占用 85 tokens，其他文件根据大小估算
            // mediaType 可能是 'image/*' 格式
            if (part.mediaType?.startsWith('image/')) {
              totalTokens += 85; // 图片大约占用 85 tokens
            } else {
              // 其他文件类型，基于数据大小估算
              totalTokens += 50;
            }
          } else if (part.type === 'tool-call' || part.type === 'tool-result') {
            totalTokens += estimateTokens(JSON.stringify(part));
          }
        }
      }
      // 每条消息加上 role 标识的 token 消耗（约 4 tokens）
      totalTokens += 4;
    }
  }

  // 估算 tools
  // 注意：tools 有两种类型：LanguageModelV3FunctionTool 和 LanguageModelV3ProviderTool
  if (params.tools && Array.isArray(params.tools)) {
    for (const tool of params.tools) {
      // 通用字段：name
      totalTokens += estimateTokens(tool.name || '');

      // 区分两种工具类型
      if (tool.type === 'function') {
        // LanguageModelV3FunctionTool: 有 description 和 inputSchema
        totalTokens += estimateTokens(tool.description || '');
        if (tool.inputSchema) {
          totalTokens += estimateTokens(JSON.stringify(tool.inputSchema));
        }
      } else if (tool.type === 'provider') {
        // LanguageModelV3ProviderTool: 有 args 而没有 description/inputSchema
        if (tool.args) {
          totalTokens += estimateTokens(JSON.stringify(tool.args));
        }
      }
    }
  }

  return totalTokens;
}

/**
 * 包装模型并添加所有中间件（DevTools + 压缩检测）
 *
 * 由于 Agent.stream 不支持 providerOptions，
 * 压缩检测中间件需要通过工厂函数传入元数据
 *
 * @param model - 原始语言模型
 * @param options - 压缩检测配置（可选）
 * @param options.conversationId - 会话 ID
 * @param options.contextLimit - 模型上下文上限
 * @returns 包装后的语言模型
 */
export function wrapModelWithAllMiddlewares<
  T extends Parameters<typeof wrapLanguageModel>[0]["model"]
>(model: T, options?: {
  conversationId: string;
  contextLimit: number;
}): T {
  const middlewares: LanguageModelV3Middleware[] = [];

  // 有配置时添加压缩检测中间件
  if (options) {
    middlewares.push(createCompressionDetectionMiddleware(options));
  }

  // 开发环境添加 DevTools 中间件
  if (isDevToolsEnabled) {
    middlewares.push(logInputMiddleware);
    middlewares.push(devToolsMiddleware());
  }

  return wrapLanguageModel({
    middleware: middlewares,
    model,
  }) as T;
}

/**
 * 包装语言模型，添加DevTools中间件
 * 用于调试LLM请求、响应及工具调用过程
 *
 * @param model - 原始语言模型实例
 * @returns 包装后的语言模型实例（开发环境添加DevTools中间件）
 *
 * @example
 * ```ts
 * import { gateway } from 'ai';
 * import { wrapModelWithDevTools } from '@/lib/ai';
 *
 * const model = wrapModelWithDevTools(gateway('anthropic/claude-sonnet-4-5'));
 * ```
 */
export function wrapModelWithDevTools<T extends Parameters<typeof wrapLanguageModel>[0]["model"]>(
  model: T
): T {
  // 非开发环境直接返回原始模型
  if (!isDevToolsEnabled) {
    return model;
  }

  // 使用多个 middleware：日志 middleware + DevTools middleware
  // 日志 middleware 会打印完整的 params.messages
  // DevTools middleware 用于连接 DevTools 调试工具
  return wrapLanguageModel({
    middleware: [logInputMiddleware, devToolsMiddleware()],
    model,
  }) as T;
}