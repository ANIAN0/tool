/**
 * @jest-environment node
 */

/**
 * 认证验证模块单元测试
 * 测试 getAuthContext 函数的各种场景
 */

import { getAuthContext } from "@/app/api/agent-chat/_lib/auth-context";
import type { NextRequest } from "next/server";

// 模拟 authenticateRequestOptional 依赖
jest.mock("@/lib/auth/middleware", () => ({
  authenticateRequestOptional: jest.fn(),
}));

// 导入模拟函数的类型
import { authenticateRequestOptional } from "@/lib/auth/middleware";
const mockAuthenticate = authenticateRequestOptional as jest.MockedFunction<
  typeof authenticateRequestOptional
>;

/**
 * 创建模拟的 NextRequest 对象
 * 只模拟必要的 headers 方法
 * @param headers - 模拟的 headers 对象
 * @returns 模拟的 NextRequest
 */
function createMockRequest(headers: Record<string, string | null>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
  } as NextRequest;
}

describe("getAuthContext", () => {
  // 每个测试前清除模拟状态
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("认证成功场景", () => {
    test("JWT 认证成功应返回 userId", async () => {
      // 模拟认证成功返回
      mockAuthenticate.mockResolvedValueOnce({
        success: true,
        userId: "user-jwt-123",
      });

      // 创建带 Authorization header 的请求
      const req = createMockRequest({
        Authorization: "Bearer valid-token",
      });

      const result = await getAuthContext(req);

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.userId).toBe("user-jwt-123");
      }
    });

    test("匿名用户认证成功应返回 userId", async () => {
      // 模拟匿名认证成功
      mockAuthenticate.mockResolvedValueOnce({
        success: true,
        userId: "anon-456",
      });

      // 创建带 X-Anonymous-Id header 的请求
      const req = createMockRequest({
        "X-Anonymous-Id": "anon-456",
      });

      const result = await getAuthContext(req);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.userId).toBe("anon-456");
      }
    });

    test("应正确调用 authenticateRequestOptional", async () => {
      mockAuthenticate.mockResolvedValueOnce({
        success: true,
        userId: "user-test",
      });

      const req = createMockRequest({});
      await getAuthContext(req);

      // 验证调用了正确的中间件函数
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
      expect(mockAuthenticate).toHaveBeenCalledWith(req);
    });
  });

  describe("认证失败场景", () => {
    test("未提供认证令牌应返回401错误", async () => {
      // 模拟认证失败：未提供令牌
      mockAuthenticate.mockResolvedValueOnce({
        success: false,
        error: "无法识别用户身份",
        status: 401,
      });

      const req = createMockRequest({});
      const result = await getAuthContext(req);

      // 验证失败结果
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        // 解析错误响应体
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("无法识别用户身份");
      }
    });

    test("令牌过期应返回401错误", async () => {
      // 模拟认证失败：令牌过期
      mockAuthenticate.mockResolvedValueOnce({
        success: false,
        error: "访问令牌已过期",
        status: 401,
      });

      const req = createMockRequest({
        Authorization: "Bearer expired-token",
      });
      const result = await getAuthContext(req);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("访问令牌已过期");
      }
    });

    test("无效令牌应返回401错误", async () => {
      // 模拟认证失败：无效令牌
      mockAuthenticate.mockResolvedValueOnce({
        success: false,
        error: "无效的令牌",
        status: 401,
      });

      const req = createMockRequest({
        Authorization: "Bearer invalid-token",
      });
      const result = await getAuthContext(req);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("无效的令牌");
      }
    });

    test("响应应包含正确的 Content-Type 头", async () => {
      mockAuthenticate.mockResolvedValueOnce({
        success: false,
        error: "测试错误",
        status: 401,
      });

      const req = createMockRequest({});
      const result = await getAuthContext(req);

      if (!result.ok) {
        // 验证响应头
        const contentType = result.response.headers.get("Content-Type");
        expect(contentType).toBe("application/json");
      }
    });
  });
});