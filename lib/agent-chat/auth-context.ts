/**
 * 认证验证模块
 * 包装 authenticateRequestOptional 中间件，返回 Result 类型结果
 * 便于 route.ts 使用统一的错误处理模式
 */

import { NextRequest } from "next/server";
import { authenticateRequestOptional } from "@/lib/infra/user/middleware";
import type { AuthContextResult } from "./types";

/**
 * 获取认证上下文
 * 验证请求的用户身份，返回 Result 类型结果
 *
 * @param req - Next.js 请求对象
 * @returns 认证结果，成功返回 userId，失败返回错误响应
 *
 * @example
 * ```typescript
 * // route.ts（组装者）
 * const auth = await getAuthContext(req);
 * if (!auth.ok) return auth.response;
 * // 使用 auth.userId
 * ```
 */
export async function getAuthContext(
  req: NextRequest
): Promise<AuthContextResult> {
  // 调用现有认证中间件验证用户身份
  const authResult = await authenticateRequestOptional(req);

  // 认证失败：返回错误响应
  if (!authResult.success) {
    return {
      ok: false,
      // 构造标准 JSON 错误响应
      response: new Response(
        JSON.stringify({ error: authResult.error }),
        {
          status: authResult.status,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  // 认证成功：返回用户ID
  return {
    ok: true,
    userId: authResult.userId,
  };
}