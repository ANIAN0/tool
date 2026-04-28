import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, extractAccessToken } from "./jwt";
import { getUserById } from "@/lib/db/users";

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
 * 从请求中获取用户ID（仅JWT认证）
 * @param request - Next.js请求对象
 * @returns 用户ID和认证状态
 */
export async function getAuthContext(
  request: NextRequest
): Promise<AuthContext> {
  // 从Authorization头获取JWT令牌
  const authHeader = request.headers.get("Authorization");
  const token = extractAccessToken(authHeader);

  if (token) {
    // 验证JWT令牌
    const result = verifyAccessToken(token);
    console.log("[getAuthContext] JWT 验证结果:", JSON.stringify(result));
    if (result.valid && result.payload) {
      return {
        userId: result.payload.userId,
        isAuthenticated: true,
      };
    }
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
 * 可选认证中间件 - 仅支持JWT认证
 * 未登录时返回错误，不允许匿名访问
 *
 * @example
 * export const POST = withOptionalAuth(async (request, context) => {
 *   // context.userId 已验证
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

    return handler(request, {
      userId: result.payload!.userId,
      isAuthenticated: true,
    });
  };
}

/**
 * 认证请求结果类型 - 成功
 */
interface AuthRequestSuccessResult {
  success: true;
  userId: string;
}

/**
 * 认证请求结果类型 - 失败
 */
interface AuthRequestErrorResult {
  success: false;
  error: string;
  status: number;
}

/**
 * 认证请求结果类型
 */
type AuthRequestResult = AuthRequestSuccessResult | AuthRequestErrorResult;

/**
 * 验证请求并返回认证结果（仅JWT认证）
 * 用于API路由中手动验证请求
 *
 * @param request - Next.js请求对象
 * @returns 认证结果，包含userId或错误信息
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthRequestResult> {
  const authHeader = request.headers.get("Authorization");
  const token = extractAccessToken(authHeader);

  if (!token) {
    return {
      success: false,
      error: "未提供认证令牌",
      status: 401,
    } as AuthRequestErrorResult;
  }

  const result = verifyAccessToken(token);

  if (!result.valid) {
    if (result.error === "访问令牌已过期") {
      return {
        success: false,
        error: result.error,
        status: 401,
      } as AuthRequestErrorResult;
    }
    return {
      success: false,
      error: result.error || "无效的令牌",
      status: 401,
    } as AuthRequestErrorResult;
  }

  return {
    success: true,
    userId: result.payload!.userId,
  } as AuthRequestSuccessResult;
}

/**
 * 可选认证请求验证（仅JWT认证）
 * 未登录时返回错误，不允许匿名访问
 *
 * @param request - Next.js请求对象
 * @returns 认证结果，包含userId或错误信息
 */
export async function authenticateRequestOptional(
  request: NextRequest
): Promise<AuthRequestResult> {
  // 检查是否有 JWT token
  const authHeader = request.headers.get("Authorization");
  const token = extractAccessToken(authHeader);

  if (!token) {
    return {
      success: false,
      error: "未提供认证令牌",
      status: 401,
    } as AuthRequestErrorResult;
  }

  const result = verifyAccessToken(token);
  if (result.valid && result.payload) {
    return {
      success: true,
      userId: result.payload.userId,
    };
  }

  // token 验证失败
  if (result.error === "访问令牌已过期") {
    return {
      success: false,
      error: "访问令牌已过期",
      status: 401,
    };
  }

  return {
    success: false,
    error: result.error || "无效的令牌",
    status: 401,
  };
}

/**
 * 检查用户是否为注册用户（非匿名）
 * 用于限制某些操作仅限注册用户执行
 *
 * @param userId - 用户ID
 * @returns 是否为注册用户
 */
export async function isRegisteredUser(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return user !== null && !user.is_anonymous;
}