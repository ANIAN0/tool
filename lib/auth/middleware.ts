import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, extractAccessToken } from "./jwt";
import { getOrCreateUser } from "@/lib/db/users";

// 认证上下文，传递给被包装的处理器
export interface AuthContext {
  userId: string;
  isAuthenticated: boolean;
}

// 认证错误响应类型
interface AuthErrorResponse {
  success: false;
  error: string;
  code: "UNAUTHORIZED" | "TOKEN_EXPIRED" | "TOKEN_INVALID";
}

/**
 * 创建认证错误响应
 */
function createAuthErrorResponse(
  message: string,
  code: AuthErrorResponse["code"]
): NextResponse<AuthErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    { status: 401 }
  );
}

/**
 * 从请求中获取用户ID
 * 优先从JWT令牌获取，其次从请求体获取匿名ID
 * @param request - Next.js请求对象
 * @returns 用户ID和认证状态
 */
export async function getAuthContext(
  request: NextRequest
): Promise<AuthContext> {
  // 尝试从Authorization头获取JWT令牌
  const authHeader = request.headers.get("Authorization");
  const token = extractAccessToken(authHeader);

  if (token) {
    // 验证JWT令牌
    const result = verifyAccessToken(token);
    if (result.valid && result.payload) {
      return {
        userId: result.payload.userId,
        isAuthenticated: true,
      };
    }
  }

  // 尝试从请求体获取匿名用户ID（仅POST请求）
  if (request.method === "POST") {
    try {
      const body = await request.clone().json();
      if (body.anonymousId && typeof body.anonymousId === "string") {
        // 确保用户存在
        const user = await getOrCreateUser(body.anonymousId);
        return {
          userId: user.id,
          isAuthenticated: false,
        };
      }
    } catch {
      // 解析失败，忽略
    }
  }

  // 尝试从查询参数获取匿名用户ID
  const anonymousId = request.nextUrl.searchParams.get("anonymousId");
  if (anonymousId) {
    const user = await getOrCreateUser(anonymousId);
    return {
      userId: user.id,
      isAuthenticated: false,
    };
  }

  // 无法识别用户
  return {
    userId: "",
    isAuthenticated: false,
  };
}

/**
 * 认证中间件 - 必须登录才能访问
 * 用于保护需要认证的API端点
 *
 * @example
 * export const POST = withAuth(async (request, context) => {
 *   // context.userId 已验证
 *   // context.isAuthenticated 为 true
 *   return NextResponse.json({ userId: context.userId });
 * });
 */
export function withAuth<T>(
  handler: (
    request: NextRequest,
    context: AuthContext
  ) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T | AuthErrorResponse>> {
  return async (request: NextRequest) => {
    const authHeader = request.headers.get("Authorization");
    const token = extractAccessToken(authHeader);

    if (!token) {
      return createAuthErrorResponse("未提供认证令牌", "UNAUTHORIZED");
    }

    const result = verifyAccessToken(token);

    if (!result.valid) {
      if (result.error === "访问令牌已过期") {
        return createAuthErrorResponse(result.error, "TOKEN_EXPIRED");
      }
      return createAuthErrorResponse(result.error || "无效的令牌", "TOKEN_INVALID");
    }

    // 调用实际处理器
    return handler(request, {
      userId: result.payload!.userId,
      isAuthenticated: true,
    });
  };
}

/**
 * 可选认证中间件 - 支持匿名用户和认证用户
 * 无论是否登录都可以访问，但会识别用户身份
 *
 * @example
 * export const POST = withOptionalAuth(async (request, context) => {
 *   // context.userId 可能是匿名用户或认证用户
 *   // context.isAuthenticated 表示是否已登录
 *   return NextResponse.json({ userId: context.userId });
 * });
 */
export function withOptionalAuth<T>(
  handler: (
    request: NextRequest,
    context: AuthContext
  ) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T | AuthErrorResponse>> {
  return async (request: NextRequest) => {
    const context = await getAuthContext(request);

    if (!context.userId) {
      return createAuthErrorResponse("无法识别用户身份", "UNAUTHORIZED");
    }

    return handler(request, context);
  };
}

/**
 * 检查用户是否为认证用户（非匿名）
 * @param userId - 用户ID
 * @returns 是否为认证用户
 */
export async function isRegisteredUser(userId: string): Promise<boolean> {
  const { getUserById } = await import("@/lib/db/users");
  const user = await getUserById(userId);
  return user !== null && !user.is_anonymous;
}

/**
 * 检查Agent是否为私有Agent
 * @param agentId - Agent ID
 * @returns 是否需要登录
 */
export async function isPrivateAgent(agentId: string): Promise<boolean> {
  const { getAgentConfig } = await import("@/lib/agents/config");
  const config = getAgentConfig(agentId);
  return config?.isPrivate === true;
}
