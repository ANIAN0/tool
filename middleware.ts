/**
 * Next.js Middleware
 * 登录拦截：对需要认证的路由进行保护
 *
 * 注意：Middleware 运行在 Edge Runtime，不能使用 Node.js API
 * 此处仅检查 cookie 是否存在，完整 JWT 验证在 Server Component 进行
 */

import { NextRequest, NextResponse } from "next/server";

// Cookie 名称常量
const COOKIE_NAMES = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
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
 * Middleware 入口函数
 * 检查用户是否已登录（cookie 是否存在），未登录则重定向到登录页
 *
 * 由于 Edge Runtime 不支持 Node.js 的 jsonwebtoken 库，
 * 此处仅做 cookie 存在性检查，完整的 JWT 验证由 Server Component 进行
 */
export async function middleware(request: NextRequest) {
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

  // 从 cookie 读取访问令牌（仅检查是否存在）
  const accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

  if (!accessToken) {
    // 未登录，重定向到登录页
    const loginUrl = new URL("/login", request.url);
    // 保存原始请求路径，登录后可跳转回来
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie 存在，继续请求（完整验证由 Server Component 进行）
  return NextResponse.next();
}

/**
 * Middleware 配置
 * 指定哪些路径需要经过 middleware
 */
export const config = {
  matcher: [
    // 匹配所有路径，排除静态资源和 API（除了需要保护的 API）
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};