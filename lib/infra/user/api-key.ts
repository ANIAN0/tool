/**
 * API Key 鉴权中间件
 * 用于对外接口的 API Key 验证
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hashApiKey } from "@/lib/db/api-keys";
import { checkRateLimit, recordFailure } from "./rate-limiter";

/**
 * API Key 认证结果类型
 */
export interface ApiKeyAuthResult {
  success: true;
  userId: string;
}

/**
 * API Key 认证错误类型
 * 包含速率限制相关的错误码
 */
export interface ApiKeyAuthError {
  success: false;
  error: string;
  code: "UNAUTHORIZED" | "INVALID_API_KEY" | "RATE_LIMITED" | "RATE_LIMIT_EXCEEDED";
}

/**
 * 从请求头提取 API Key
 * 支持格式: Authorization: Bearer sk_live_xxx
 */
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  // 支持 Bearer 格式
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 也支持直接传递 Key
  return authHeader.trim();
}

/**
 * 验证 API Key 并获取用户 ID
 * 用于对外接口的鉴权
 * 包含速率限制检查防止滥用
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<ApiKeyAuthResult | ApiKeyAuthError> {
  // 获取客户端IP（支持代理场景）
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // 检查速率限制
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    // 根据锁定状态返回不同的错误信息
    if (rateCheck.locked) {
      return {
        success: false,
        error: "请求过于频繁，请稍后再试",
        code: "RATE_LIMITED",
      };
    }
    return {
      success: false,
      error: "请求次数超限，请稍后再试",
      code: "RATE_LIMIT_EXCEEDED",
    };
  }

  // 提取 API Key
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    // 记录失败（无API Key也算失败）
    recordFailure(clientIp);
    return {
      success: false,
      error: "未提供 API Key",
      code: "UNAUTHORIZED",
    };
  }

  // 验证 API Key 格式
  if (!apiKey.startsWith("sk_live_")) {
    // 记录失败（格式错误）
    recordFailure(clientIp);
    return {
      success: false,
      error: "无效的 API Key 格式",
      code: "INVALID_API_KEY",
    };
  }

  try {
    // 计算哈希
    const keyHash = await hashApiKey(apiKey);

    // 验证并获取用户 ID
    const userId = await validateApiKey(keyHash);

    if (!userId) {
      // 记录失败（无效API Key）
      recordFailure(clientIp);
      return {
        success: false,
        error: "无效的 API Key 或已过期",
        code: "INVALID_API_KEY",
      };
    }

    return {
      success: true,
      userId,
    };
  } catch (error) {
    // 记录失败（验证异常）
    recordFailure(clientIp);
    console.error("API Key 验证失败:", error);
    return {
      success: false,
      error: "API Key 验证失败",
      code: "INVALID_API_KEY",
    };
  }
}

/**
 * 创建 API 鉴权错误响应
 */
export function apiKeyErrorResponse(
  error: ApiKeyAuthError
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.error,
      },
    },
    { status: 401 }
  );
}