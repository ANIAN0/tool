/**
 * @jest-environment node
 */

/**
 * 会话管理模块单元测试
 * 测试 ensureConversation 和 loadHistory 函数的各种场景
 */

import { ensureConversation, loadHistory } from "@/app/api/agent-chat/_lib/conversation";
import type { UIMessage } from "ai";

// 模拟数据库依赖
jest.mock("@/lib/db", () => ({
  getConversation: jest.fn(),
  createConversation: jest.fn(),
}));

// 模拟压缩模块依赖
jest.mock("@/lib/db/compression", () => ({
  getPendingCompressionTask: jest.fn(),
  completeCompressionTask: jest.fn(),
  loadHistoryMessages: jest.fn(),
  executeCompressionTask: jest.fn(),
}));

// 导入模拟函数的类型
import { getConversation, createConversation } from "@/lib/db";
import {
  getPendingCompressionTask,
  completeCompressionTask,
  loadHistoryMessages,
  executeCompressionTask,
} from "@/lib/db/compression";

const mockGetConversation = getConversation as jest.MockedFunction<typeof getConversation>;
const mockCreateConversation = createConversation as jest.MockedFunction<typeof createConversation>;
const mockGetPendingCompressionTask = getPendingCompressionTask as jest.MockedFunction<typeof getPendingCompressionTask>;
const mockCompleteCompressionTask = completeCompressionTask as jest.MockedFunction<typeof completeCompressionTask>;
const mockLoadHistoryMessages = loadHistoryMessages as jest.MockedFunction<typeof loadHistoryMessages>;
const mockExecuteCompressionTask = executeCompressionTask as jest.MockedFunction<typeof executeCompressionTask>;

/**
 * 创建模拟的用户消息（UIMessage 格式）
 * @param text - 消息文本内容
 * @returns 模拟的 UIMessage
 */
function createMockUserMessage(text: string): UIMessage {
  return {
    id: "msg-test",
    role: "user",
    parts: [{ type: "text", text }],
  };
}

describe("ensureConversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("对话已存在场景", () => {
    test("用户匹配应返回 conversationId", async () => {
      // 模拟对话存在且用户匹配
      mockGetConversation.mockResolvedValueOnce({
        id: "conv-123",
        user_id: "user-456",
        title: "测试对话",
        model: "gpt-4",
        agent_id: "agent-789",
        is_private: false,
        source: "agent-chat",
        created_at: Date.now(),
        updated_at: Date.now(),
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        compression_cache: null,
      });

      const result = await ensureConversation({
        conversationId: "conv-123",
        userId: "user-456", // 与对话的 user_id 匹配
        agentId: "agent-new",
        modelName: "gpt-4o",
        message: createMockUserMessage("你好"),
      });

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.conversationId).toBe("conv-123");
      }
      // 不应创建新对话
      expect(mockCreateConversation).not.toHaveBeenCalled();
    });

    test("用户不匹配应返回403错误", async () => {
      // 模拟对话存在但用户不匹配
      mockGetConversation.mockResolvedValueOnce({
        id: "conv-123",
        user_id: "user-owner", // 原始所有者
        title: "私有对话",
        model: "gpt-4",
        agent_id: "agent-789",
        is_private: false,
        source: "agent-chat",
        created_at: Date.now(),
        updated_at: Date.now(),
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        compression_cache: null,
      });

      const result = await ensureConversation({
        conversationId: "conv-123",
        userId: "user-other", // 与对话的 user_id 不匹配
        agentId: "agent-new",
        modelName: "gpt-4o",
        message: createMockUserMessage("你好"),
      });

      // 验证失败结果
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("无权访问此对话");
      }
      // 不应创建新对话
      expect(mockCreateConversation).not.toHaveBeenCalled();
    });
  });

  describe("对话不存在场景", () => {
    test("应创建新对话并返回 conversationId", async () => {
      // 模拟对话不存在
      mockGetConversation.mockResolvedValueOnce(null);
      // 模拟创建成功
      mockCreateConversation.mockResolvedValueOnce({} as any);

      const result = await ensureConversation({
        conversationId: "conv-new",
        userId: "user-456",
        agentId: "agent-789",
        modelName: "gpt-4o",
        message: createMockUserMessage("这是一条测试消息"),
      });

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.conversationId).toBe("conv-new");
      }
      // 应调用创建对话
      expect(mockCreateConversation).toHaveBeenCalledTimes(1);
      expect(mockCreateConversation).toHaveBeenCalledWith({
        id: "conv-new",
        userId: "user-456",
        title: "这是一条测试消息", // 从消息提取的标题
        model: "gpt-4o",
        agentId: "agent-789",
        source: "agent-chat",
      });
    });

    test("长消息应截取前50字符并添加省略号", async () => {
      mockGetConversation.mockResolvedValueOnce(null);
      mockCreateConversation.mockResolvedValueOnce({} as any);

      const longText = "这是一条非常长的测试消息，用于验证标题截取逻辑是否正确工作，超过五十个字符的部分应该被截断并添加省略号";
      const result = await ensureConversation({
        conversationId: "conv-new",
        userId: "user-456",
        agentId: "agent-789",
        modelName: "gpt-4o",
        message: createMockUserMessage(longText),
      });

      expect(result.ok).toBe(true);
      // 验证标题以省略号结尾
      expect(mockCreateConversation).toHaveBeenCalledWith({
        id: "conv-new",
        userId: "user-456",
        title: expect.stringMatching(/\.\.\.$/), // 以省略号结尾
        model: "gpt-4o",
        agentId: "agent-789",
        source: "agent-chat",
      });
      // 验证标题总长度不超过53字符（50字符 + 3个点）
      const callArgs = mockCreateConversation.mock.calls[0][0];
      expect(callArgs.title.length).toBeLessThanOrEqual(53);
    });

    test("空消息应使用默认标题", async () => {
      mockGetConversation.mockResolvedValueOnce(null);
      mockCreateConversation.mockResolvedValueOnce({} as any);

      const result = await ensureConversation({
        conversationId: "conv-new",
        userId: "user-456",
        agentId: "agent-789",
        modelName: "gpt-4o",
        message: createMockUserMessage(""), // 空消息
      });

      expect(result.ok).toBe(true);
      expect(mockCreateConversation).toHaveBeenCalledWith({
        id: "conv-new",
        userId: "user-456",
        title: "新对话", // 默认标题
        model: "gpt-4o",
        agentId: "agent-789",
        source: "agent-chat",
      });
    });

    test("非用户消息应使用默认标题", async () => {
      mockGetConversation.mockResolvedValueOnce(null);
      mockCreateConversation.mockResolvedValueOnce({} as any);

      const assistantMessage: UIMessage = {
        id: "msg-assistant",
        role: "assistant", // 非 user 角色
        parts: [{ type: "text", text: "这是助手回复" }],
      };

      const result = await ensureConversation({
        conversationId: "conv-new",
        userId: "user-456",
        agentId: "agent-789",
        modelName: "gpt-4o",
        message: assistantMessage,
      });

      expect(result.ok).toBe(true);
      expect(mockCreateConversation).toHaveBeenCalledWith({
        id: "conv-new",
        userId: "user-456",
        title: "新对话", // 默认标题（因为 role 不是 user）
        model: "gpt-4o",
        agentId: "agent-789",
        source: "agent-chat",
      });
    });
  });
});

describe("loadHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("无压缩任务场景", () => {
    test("应直接返回历史消息", async () => {
      // 模拟无待处理压缩任务
      mockGetPendingCompressionTask.mockResolvedValueOnce(null);
      // 模拟历史消息加载成功
      const mockMessages: UIMessage[] = [
        { id: "msg-1", role: "user", parts: [{ type: "text", text: "你好" }] },
        { id: "msg-2", role: "assistant", parts: [{ type: "text", text: "你好！有什么可以帮助你的？" }] },
      ];
      mockLoadHistoryMessages.mockResolvedValueOnce(mockMessages);

      const result = await loadHistory("conv-123");

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.messages).toEqual(mockMessages);
      }
      // 不应执行压缩相关操作
      expect(mockExecuteCompressionTask).not.toHaveBeenCalled();
      expect(mockCompleteCompressionTask).not.toHaveBeenCalled();
    });
  });

  describe("有压缩任务场景", () => {
    test("压缩成功应返回处理后的历史消息", async () => {
      // 模拟有待处理压缩任务
      mockGetPendingCompressionTask.mockResolvedValueOnce({
        id: "task-123",
        conversation_id: "conv-123",
        status: 0, // Pending
        created_at: Date.now(),
        completed_at: null,
      });
      // 模拟压缩执行成功
      mockExecuteCompressionTask.mockResolvedValueOnce({ removedCount: 5 });
      // 模拟任务完成
      mockCompleteCompressionTask.mockResolvedValueOnce();
      // 模拟历史消息加载
      mockLoadHistoryMessages.mockResolvedValueOnce([
        { id: "msg-remaining", role: "user", parts: [{ type: "text", text: "压缩后的消息" }] },
      ]);

      const result = await loadHistory("conv-123");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.messages.length).toBe(1);
      }
      // 验证压缩执行和任务完成被调用
      expect(mockExecuteCompressionTask).toHaveBeenCalledWith("conv-123");
      expect(mockCompleteCompressionTask).toHaveBeenCalledWith("task-123");
    });

    test("压缩失败应继续返回历史消息", async () => {
      // 模拟有待处理压缩任务
      mockGetPendingCompressionTask.mockResolvedValueOnce({
        id: "task-123",
        conversation_id: "conv-123",
        status: 0,
        created_at: Date.now(),
        completed_at: null,
      });
      // 模拟压缩执行失败
      mockExecuteCompressionTask.mockRejectedValueOnce(new Error("压缩失败"));
      // 模拟历史消息加载仍然成功
      mockLoadHistoryMessages.mockResolvedValueOnce([
        { id: "msg-1", role: "user", parts: [{ type: "text", text: "原始消息" }] },
      ]);

      const result = await loadHistory("conv-123");

      // 即使压缩失败，也应返回历史消息
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.messages.length).toBe(1);
      }
      // 任务完成不应被调用（任务保持 pending 状态以便下次重试）
      expect(mockCompleteCompressionTask).not.toHaveBeenCalled();
    });
  });

  describe("历史消息加载失败场景", () => {
    test("加载失败应返回500错误", async () => {
      mockGetPendingCompressionTask.mockResolvedValueOnce(null);
      // 模拟加载失败
      mockLoadHistoryMessages.mockRejectedValueOnce(new Error("数据库错误"));

      const result = await loadHistory("conv-123");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(500);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("加载历史消息失败");
      }
    });
  });
});