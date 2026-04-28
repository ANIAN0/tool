import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, generateTokenPair } from "@/lib/infra/user";

// Cookie 配置常量
const COOKIE_CONFIG = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  ACCESS_TOKEN_MAX_AGE: 60 * 15, // 15分钟
  REFRESH_TOKEN_MAX_AGE: 60 * 60 * 24 * 7, // 7天
};

// 刷新令牌请求类型
interface RefreshRequest {
  refreshToken?: string;
}

// 刷新令牌响应类型
interface RefreshResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

/**
 * 刷新令牌API
 * POST /api/auth/refresh
 *
 * 功能：
 * 1. 从请求体或 cookie 读取刷新令牌
 * 2. 验证刷新令牌
 * 3. 返回新的令牌对，同时更新 cookie
 */
export async function POST(request: NextRequest): Promise<NextResponse<RefreshResponse>> {
  try {
    // 优先从请求体获取 refreshToken，其次从 cookie 获取
    let refreshToken: string | undefined;

    try {
      const body: RefreshRequest = await request.json();
      refreshToken = body.refreshToken;
    } catch {
      // 请求体解析失败，尝试从 cookie 获取
    }

    // 如果请求体中没有，从 cookie 读取
    if (!refreshToken) {
      refreshToken = request.cookies.get(COOKIE_CONFIG.REFRESH_TOKEN)?.value;
    }

    // 验证必填字段
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: "刷新令牌不能为空" },
        { status: 400 }
      );
    }

    // 验证刷新令牌
    const result = verifyRefreshToken(refreshToken);

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.error || "无效的刷新令牌" },
        { status: 401 }
      );
    }

    // 生成新的令牌对
    const tokens = generateTokenPair(result.payload!.userId);

    // 创建响应对象
    const response = NextResponse.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    // 更新 cookie 存储
    response.cookies.set(COOKIE_CONFIG.ACCESS_TOKEN, tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_CONFIG.ACCESS_TOKEN_MAX_AGE,
      path: "/",
    });

    response.cookies.set(COOKIE_CONFIG.REFRESH_TOKEN, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("刷新令牌失败:", error);
    return NextResponse.json(
      { success: false, error: "刷新令牌失败，请稍后重试" },
      { status: 500 }
    );
  }
}
