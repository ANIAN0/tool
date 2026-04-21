/**
 * @jest-environment node
 */

/**
 * 响应构建模块单元测试
 * 测试 buildStreamResponse 函数的各种场景
 */

import { buildStreamResponse } from "@/app/api/agent-chat/_lib/response";
import type { StreamResponseConfig } from "@/app/api/agent-chat/_lib/types";
import type { StreamTextResult, UIMessage, TextStreamPart, ToolSet, FinishReason } from "ai";

// 模拟 next/server 的 after 函数
jest.mock("next/server", () => ({
  after: jest.fn((fn: () => Promise<void>) => fn()),
}));

// 模拟 nanoid
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "test-message-id"),
}));

// 模拟数据库操作
jest.mock("@/lib/db", () => ({
  createMessage: jest.fn(),
  updateConversationTokenTotals: jest.fn(),
  touchConversation: jest.fn(),
}));

// 导入模拟函数
import { after } from "next/server";
import { nanoid } from "nanoid";
import {
  createMessage,
  updateConversationTokenTotals,
  touchConversation,
} from "@/lib/db";

const mockAfter = after as jest.MockedFunction<typeof after>;
const mockNanoid = nanoid as jest.MockedFunction<typeof nanoid>;
const mockCreateMessage = createMessage as jest.MockedFunction<typeof createMessage>;
const mockUpdateTokenTotals = updateConversationTokenTotals as jest.MockedFunction<typeof updateConversationTokenTotals>;
const mockTouchConversation = touchConversation as jest.MockedFunction<typeof touchConversation>;

/**
 * 创建模拟的 StreamTextResult 对象
 * 模拟 toUIMessageStreamResponse 方法和 totalUsage
 */
function createMockStreamResult(options: {
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}): StreamTextResult<ToolSet, never> {
  // 创建模拟的 Response 对象
  const mockResponse = new Response("test stream data", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });

  // 创建模拟的 StreamTextResult
  const mockResult = {
    // 模拟 totalUsage Promise
    totalUsage: Promise.resolve(options.usage || null),
    // 模拟 consumeStream 方法
    consumeStream: jest.fn(),
    // 模拟 toUIMessageStreamResponse 方法
    toUIMessageStreamResponse: jest.fn((config: {
      sendSources?: boolean;
      sendReasoning?: boolean;
      messageMetadata?: (params: { part: TextStreamPart<ToolSet> }) => unknown;
      onFinish?: (params: { responseMessage?: UIMessage; finishReason?: FinishReason }) => Promise<void>;
    }) => {
      // 存储配置以便测试验证
      (mockResult as unknown as Record<string, unknown>).streamConfig = config;
      return mockResponse;
    }),
  } as unknown as StreamTextResult<ToolSet, never>;

  return mockResult;
}

/**
 * 获取 onFinish 回调并执行
 * 用于测试 onFinish 内部的逻辑
 */
async function executeOnFinish(
  mockResult: StreamTextResult<ToolSet, never>,
  params: {
    responseMessage?: UIMessage;
    finishReason?: FinishReason;
  }
): Promise<void> {
  // 获取存储的配置
  const config = (mockResult as unknown as Record<string, unknown>).streamConfig as {
    onFinish?: (params: { responseMessage?: UIMessage; finishReason?: FinishReason }) => Promise<void>;
  };

  // 执行 onFinish 回调
  if (config?.onFinish) {
    await config.onFinish(params);
  }
}

/**
 * 获取 messageMetadata 回调并执行
 * 用于测试 messageMetadata 内部的逻辑
 */
function executeMessageMetadata(
  mockResult: StreamTextResult<ToolSet, never>,
  partType: string,
  totalUsage?: unknown
): unknown {
  const config = (mockResult as unknown as Record<string, unknown>).streamConfig as {
    messageMetadata?: (params: { part: TextStreamPart<ToolSet> }) => unknown;
  };

  if (config?.messageMetadata) {
    // 构造模拟的 part 对象
    const mockPart = { type: partType, totalUsage } as unknown as TextStreamPart<ToolSet>;
    return config.messageMetadata({ part: mockPart });
  }
  return undefined;
}

describe("buildStreamResponse", () => {
  // 默认配置
  const defaultConfig: StreamResponseConfig = {
    conversationId: "conv-test-123",
    contextLimit: 32000,
    modelName: "gpt-4",
    mcpCleanup: jest.fn(),
  };

  // 每个测试前清除模拟状态
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置 nanoid 返回固定值
    mockNanoid.mockReturnValue("test-message-id");
  });

  describe("响应构建场景", () => {
    test("应正确配置 sendSources 和 sendReasoning", () => {
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, defaultConfig);

      // 验证配置选项
      const config = (mockResult as unknown as Record<string, unknown>).streamConfig as Record<string, unknown>;
      expect(config.sendSources).toBe(true);
      expect(config.sendReasoning).toBe(true);
    });

    test("finish 事件应返回正确的元数据", () => {
      const mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
      const mockResult = createMockStreamResult({ usage: mockUsage });
      buildStreamResponse(mockResult, defaultConfig);

      // 执行 messageMetadata 回调
      const metadata = executeMessageMetadata(mockResult, "finish", mockUsage);

      // 验证返回的元数据
      expect(metadata).toEqual({
        usage: mockUsage,
        contextLimit: 32000,
        modelName: "gpt-4",
      });
    });

    test("非 finish 事件应返回 undefined", () => {
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, defaultConfig);

      // 执行 messageMetadata 回调（非 finish 类型）
      const metadata = executeMessageMetadata(mockResult, "text", null);

      expect(metadata).toBeUndefined();
    });

    test("应返回 Response 对象", () => {
      const mockResult = createMockStreamResult({});
      const response = buildStreamResponse(mockResult, defaultConfig);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });
  });

  describe("onFinish 回调场景", () => {
    test("正常完成时应保存消息并更新统计", async () => {
      const mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
      const mockResult = createMockStreamResult({ usage: mockUsage });
      buildStreamResponse(mockResult, defaultConfig);

      // 模拟正常完成
      await executeOnFinish(mockResult, {
        responseMessage: {
          id: "response-msg",
          role: "assistant",
          parts: [{ type: "text", text: "回复内容" }],
        },
        finishReason: "stop",
      });

      // 验证创建了消息
      expect(mockCreateMessage).toHaveBeenCalledTimes(1);
      expect(mockCreateMessage).toHaveBeenCalledWith({
        id: "test-message-id",
        conversationId: "conv-test-123",
        role: "assistant",
        content: expect.stringContaining("assistant"),
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      });

      // 验证使用了 after() 执行延迟操作
      expect(mockAfter).toHaveBeenCalled();
    });

    test("无 usage 时仍应保存消息并更新会话时间", async () => {
      const mockResult = createMockStreamResult({ usage: undefined });
      buildStreamResponse(mockResult, defaultConfig);

      // 模拟正常完成但无 usage
      await executeOnFinish(mockResult, {
        responseMessage: {
          id: "response-msg",
          role: "assistant",
          parts: [{ type: "text", text: "回复" }],
        },
        finishReason: "stop",
      });

      // 验证创建了消息（token 字段为 undefined）
      expect(mockCreateMessage).toHaveBeenCalledWith({
        id: "test-message-id",
        conversationId: "conv-test-123",
        role: "assistant",
        content: expect.any(String),
        input_tokens: undefined,
        output_tokens: undefined,
        total_tokens: undefined,
      });

      // 验证 still calls after for touchConversation
      expect(mockAfter).toHaveBeenCalled();
    });

    test("错误完成时不应保存消息", async () => {
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, defaultConfig);

      // 模拟错误完成
      await executeOnFinish(mockResult, {
        responseMessage: undefined,
        finishReason: "error",
      });

      // 验证未创建消息
      expect(mockCreateMessage).not.toHaveBeenCalled();
      expect(mockUpdateTokenTotals).not.toHaveBeenCalled();
      expect(mockTouchConversation).not.toHaveBeenCalled();
    });

    test("应执行 MCP 清理函数", async () => {
      const mockCleanup = jest.fn();
      const config: StreamResponseConfig = {
        ...defaultConfig,
        mcpCleanup: mockCleanup,
      };
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, config);

      // 执行 onFinish（正常完成）
      await executeOnFinish(mockResult, {
        finishReason: "stop",
      });

      // 验证清理函数被调用
      expect(mockCleanup).toHaveBeenCalledTimes(1);
    });

    test("MCP 清理函数为 null 时不应抛错", async () => {
      const config: StreamResponseConfig = {
        ...defaultConfig,
        mcpCleanup: null,
      };
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, config);

      // 执行 onFinish
      await executeOnFinish(mockResult, {
        finishReason: "stop",
      });

      // 应正常完成，无异常
    });

    test("MCP 清理失败时应记录警告但不影响流程", async () => {
      const mockCleanup = jest.fn().mockRejectedValueOnce(new Error("清理失败"));
      const config: StreamResponseConfig = {
        ...defaultConfig,
        mcpCleanup: mockCleanup,
      };
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, config);

      // 执行 onFinish（清理应捕获错误）
      await executeOnFinish(mockResult, {
        finishReason: "stop",
      });

      // 验证清理函数被尝试调用
      expect(mockCleanup).toHaveBeenCalledTimes(1);
      // 消息保存等其他操作不受影响
    });

    test("消息保存失败时应记录错误但继续清理", async () => {
      // 模拟 createMessage 失败
      mockCreateMessage.mockRejectedValueOnce(new Error("数据库错误"));
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, defaultConfig);

      // 执行 onFinish
      await executeOnFinish(mockResult, {
        finishReason: "stop",
      });

      // 验证 MCP 清理仍然执行
      expect(defaultConfig.mcpCleanup).toHaveBeenCalledTimes(1);
    });

    test("错误完成时仍应执行 MCP 清理", async () => {
      const mockCleanup = jest.fn();
      const config: StreamResponseConfig = {
        ...defaultConfig,
        mcpCleanup: mockCleanup,
      };
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, config);

      // 执行 onFinish（错误完成）
      await executeOnFinish(mockResult, {
        finishReason: "error",
      });

      // 验证清理函数仍被调用
      expect(mockCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe("边界场景", () => {
    test("responseMessage 为 undefined 时应使用空 parts", async () => {
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, defaultConfig);

      // 执行 onFinish（无 responseMessage）
      await executeOnFinish(mockResult, {
        responseMessage: undefined,
        finishReason: "stop",
      });

      // 验证创建了消息，parts 为空数组
      expect(mockCreateMessage).toHaveBeenCalled();
      const savedMessage = mockCreateMessage.mock.calls[0][0];
      const parsedContent = JSON.parse(savedMessage.content) as UIMessage;
      expect(parsedContent.parts).toEqual([]);
    });

    test("responseMessage.parts 为空时应正确处理", async () => {
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, defaultConfig);

      // 执行 onFinish（parts 为空）
      await executeOnFinish(mockResult, {
        responseMessage: {
          id: "response-msg",
          role: "assistant",
          parts: [],
        },
        finishReason: "stop",
      });

      // 验证正确处理空 parts
      expect(mockCreateMessage).toHaveBeenCalled();
    });

    test("不同 contextLimit 和 modelName 应正确传递", () => {
      const customConfig: StreamResponseConfig = {
        conversationId: "conv-custom",
        contextLimit: 128000,
        modelName: "claude-3-opus",
        mcpCleanup: null,
      };
      const mockResult = createMockStreamResult({});
      buildStreamResponse(mockResult, customConfig);

      // 执行 messageMetadata 回调
      const metadata = executeMessageMetadata(mockResult, "finish", {});

      expect(metadata).toEqual({
        usage: {},
        contextLimit: 128000,
        modelName: "claude-3-opus",
      });
    });
  });
});