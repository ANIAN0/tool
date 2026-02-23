import { NextResponse } from "next/server";
import { withOptionalAuth, type AuthContext } from "@/lib/auth/middleware";
import { getUserById } from "@/lib/db/users";

// 用户信息响应类型
type MeResponse = {
  success: boolean;
  user?: {
    id: string;
    username: string | null;
    isAnonymous: boolean;
    createdAt: number;
  };
  error?: string;
};

/**
 * 获取当前用户信息API
 * GET /api/auth/me
 * 
 * 功能：
 * 1. 支持JWT令牌认证
 * 2. 支持匿名用户（通过请求体或查询参数）
 * 3. 返回用户信息
 */
export const GET = withOptionalAuth<MeResponse>(async (_request, context: AuthContext) => {
  try {
    // 获取用户信息
    const user = await getUserById(context.userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "用户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAnonymous: user.is_anonymous,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("获取用户信息失败:", error);
    return NextResponse.json(
      { success: false, error: "获取用户信息失败" },
      { status: 500 }
    );
  }
});
