/**
 * @jest-environment node
 */

/**
 * 请求解析模块单元测试
 * 测试 parseChatRequestBody 函数的各种场景
 */

import { parseChatRequestBody } from "@/app/api/agent-chat/_lib/request";
import type { NextRequest } from "next/server";

/**
 * 创建模拟的 NextRequest 对象
 * 只模拟 json() 方法，不依赖真实的 Request 类
 * @param body - 请求体内容
 * @returns 模拟的 NextRequest
 */
function createMockRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as NextRequest;
}

describe("parseChatRequestBody", () => {
  describe("解析成功场景", () => {
    test("完整请求体应成功解析", async () => {
      // 构造完整的请求体
      const body = {
        message: {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "你好" }],
        },
        conversationId: "conv-123",
        agentId: "agent-456",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.message).toEqual(body.message);
        expect(result.data.conversationId).toBe("conv-123");
        expect(result.data.agentId).toBe("agent-456");
      }
    });

    test("缺少 conversationId（可选字段）应成功解析", async () => {
      // 构造缺少可选字段的请求体
      const body = {
        message: {
          id: "msg-2",
          role: "user",
          parts: [{ type: "text", text: "测试消息" }],
        },
        agentId: "agent-789",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      // 验证成功结果，conversationId 应为 undefined
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.message).toEqual(body.message);
        expect(result.data.conversationId).toBeUndefined();
        expect(result.data.agentId).toBe("agent-789");
      }
    });

    test("复杂消息结构应成功解析", async () => {
      // 构造包含多种 parts 的复杂消息
      const body = {
        message: {
          id: "msg-3",
          role: "user",
          parts: [
            { type: "text", text: "请分析这段代码" },
            { type: "image", url: "https://example.com/image.png" },
          ],
        },
        conversationId: "conv-complex",
        agentId: "agent-pro",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.message.parts.length).toBe(2);
      }
    });
  });

  describe("解析失败场景", () => {
    test("缺少 message 字段应返回400错误", async () => {
      // 构造缺少 message 的请求体
      const body = {
        conversationId: "conv-123",
        agentId: "agent-456",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      // 验证失败结果
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        // 解析错误响应体
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("消息不能为空");
      }
    });

    test("message 为 null 应返回400错误", async () => {
      const body = {
        message: null,
        agentId: "agent-456",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("消息不能为空");
      }
    });

    test("缺少 agentId 字段应返回400错误", async () => {
      const body = {
        message: {
          id: "msg-4",
          role: "user",
          parts: [{ type: "text", text: "你好" }],
        },
        conversationId: "conv-123",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("Agent ID不能为空");
      }
    });

    test("agentId 为空字符串应返回400错误", async () => {
      const body = {
        message: {
          id: "msg-5",
          role: "user",
          parts: [{ type: "text", text: "你好" }],
        },
        agentId: "",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("Agent ID不能为空");
      }
    });

    test("同时缺少 message 和 agentId 应优先返回消息错误", async () => {
      // 构造同时缺少两个必需字段的请求体
      const body = {
        conversationId: "conv-123",
      };

      const req = createMockRequest(body);
      const result = await parseChatRequestBody(req);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        // 应优先报告消息缺失
        expect(errorBody.error).toBe("消息不能为空");
      }
    });

    test("无效 JSON 应返回400错误", async () => {
      // 模拟 json() 方法抛出解析错误
      const req = {
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as NextRequest;

      const result = await parseChatRequestBody(req);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("请求体格式无效，无法解析JSON");
      }
    });
  });
});