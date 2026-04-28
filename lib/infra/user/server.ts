/**
 * Server Component 认证工具
 * 从 cookie 读取 JWT token 并验证用户身份
 * 仅供 Server Component 和 middleware 使用
 */

import { cookies } from "next/headers";
import { verifyAccessToken } from "./jwt";

// Cookie 名称常量
const COOKIE_NAMES = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
};

// Server Component 认证结果类型
export interface ServerAuthResult {
  // 用户ID
  userId: string | null;
  // 是否已认证（非匿名）
  isAuthenticated: boolean;
  // 错误信息
  error?: string;
}

/**
 * Server Component 认证函数
 * 从 cookie 读取 JWT token 并验证用户身份
 *
 * @returns 认证结果，包含 userId 和 isAuthenticated
 *
 * @example
 * // 在 Server Component 中使用
 * import { auth } from "@/lib/auth/server";
 *
 * export default async function Page() {
 *   const user = await auth();
 *   if (!user.userId) {
 *     redirect("/login");
 *   }
 *   return <ClientComponent userId={user.userId} />;
 * }
 */
export async function auth(): Promise<ServerAuthResult> {
  try {
    // 获取 cookie 存储
    const cookieStore = await cookies();

    // 读取访问令牌
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

    if (!accessToken) {
      return {
        userId: null,
        isAuthenticated: false,
        error: "未登录",
      };
    }

    // 验证令牌
    const result = verifyAccessToken(accessToken);

    if (!result.valid) {
      return {
        userId: null,
        isAuthenticated: false,
        error: result.error || "令牌无效",
      };
    }

    // 返回认证结果
    return {
      userId: result.payload!.userId,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error("[auth] 认证检查失败:", error);
    return {
      userId: null,
      isAuthenticated: false,
      error: "认证检查失败",
    };
  }
}

/**
 * 从 cookie 读取 refresh token
 * 用于 middleware 中尝试刷新访问令牌
 *
 * @returns refresh token 或 null
 */
export async function getRefreshTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * 检查用户是否已认证（简化的布尔返回）
 * 用于需要快速判断的场景
 *
 * @returns 是否已认证
 */
export async function isAuthenticated(): Promise<boolean> {
  const result = await auth();
  return result.isAuthenticated;
}