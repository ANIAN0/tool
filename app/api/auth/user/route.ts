import { NextResponse } from "next/server";
import { withAuth, type AuthContext } from "@/lib/infra/user/middleware";
import { deleteUser } from "@/lib/db/users";

// 删除用户响应类型
type DeleteUserResponse = {
  success: boolean;
  error?: string;
};

/**
 * 删除用户 API
 * DELETE /api/auth/user
 *
 * 功能：
 * 1. 需要认证（仅登录用户可删除自己的账户）
 * 2. 删除用户记录
 *
 * 注意：此操作不可逆，会永久删除用户数据
 */
export const DELETE = withAuth<DeleteUserResponse>(
  async (_request, context: AuthContext) => {
    try {
      // 删除用户
      const deleted = await deleteUser(context.userId);

      if (!deleted) {
        return NextResponse.json(
          { success: false, error: "用户不存在或已删除" },
          { status: 404 }
        );
      }

      // 清除 Cookie 中的令牌
      const response = NextResponse.json({ success: true });
      response.cookies.set("accessToken", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0, // 立即过期
        path: "/",
      });
      response.cookies.set("refreshToken", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });

      return response;
    } catch (error) {
      console.error("删除用户失败:", error);
      return NextResponse.json(
        { success: false, error: "删除用户失败" },
        { status: 500 }
      );
    }
  }
);