/**
 * Next.js Proxy（原 Middleware）
 * 登录拦截：对需要认证的路由进行保护
 *
 * 注意：Proxy 运行在 Node.js 运行时，可使用 Node.js API
 * 此处仅做 JWT payload 解码和过期检查，完整的签名验证由 Server Component 进行
 */

import { NextRequest, NextResponse } from "next/server";

// Cookie 名称常量
const COOKIE_NAMES = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
};

// Cookie 配置
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// 需要登录保护的路径前缀
const AUTH_REQUIRED_PATHS = [
  "/workflowchat",
  "/agent-chat",
  "/settings",
];

// 公开路径（不需要登录）
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth", // 认证相关 API
];

/**
 * 解码 JWT payload（不验证签名）
 * 用于检查 token 是否过期
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // 解码 payload（第二部分）
    const payload = parts[1];
    // 处理 base64url 编码
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * 检查 JWT 是否已过期
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;

  // exp 是秒级时间戳
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * 从 refreshToken 生成新的 accessToken
 * 调用内部 refresh API
 */
async function refreshAccessToken(
  request: NextRequest,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    // 构造 refresh API 请求
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    const response = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.accessToken) return null;

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch (error) {
    console.error("[proxy] 刷新 token 失败:", error);
    return null;
  }
}

/**
 * Proxy 入口函数
 * 检查用户是否已登录，如果 accessToken 过期则尝试自动刷新
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 检查是否是公开路径
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 检查是否是需要认证的路径
  const requiresAuth = AUTH_REQUIRED_PATHS.some((path) => pathname.startsWith(path));
  if (!requiresAuth) {
    return NextResponse.next();
  }

  // 从 cookie 读取访问令牌
  let accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;

  // 如果 accessToken 不存在，尝试使用 refreshToken 刷新
  if (!accessToken) {
    if (!refreshToken) {
      // 都不存在，重定向到登录页
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 尝试刷新 token
    const tokens = await refreshAccessToken(request, refreshToken);
    if (!tokens) {
      // 刷新失败，重定向到登录页
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 刷新成功，使用新 token 继续请求并更新 cookie
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 15, // 15分钟
    });
    response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7, // 7天
    });
    return response;
  }

  // accessToken 存在，检查是否过期
  if (isTokenExpired(accessToken)) {
    // accessToken 过期，尝试刷新
    if (!refreshToken) {
      // 没有 refreshToken，重定向到登录页
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 尝试刷新 token
    const tokens = await refreshAccessToken(request, refreshToken);
    if (!tokens) {
      // 刷新失败，重定向到登录页
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 刷新成功，更新 cookie 并继续
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 15, // 15分钟
    });
    response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7, // 7天
    });
    return response;
  }

  // accessToken 有效，继续请求
  return NextResponse.next();
}

/**
 * Proxy 配置
 * 指定哪些路径需要经过 proxy
 */
export const config = {
  matcher: [
    // 匹配所有路径，排除静态资源和 API（除了需要保护的 API）
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
