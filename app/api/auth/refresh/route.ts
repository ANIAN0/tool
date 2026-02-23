import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, generateTokenPair } from "@/lib/auth";

// 刷新令牌请求类型
interface RefreshRequest {
  refreshToken: string;
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
 * 1. 验证刷新令牌
 * 2. 返回新的令牌对
 */
export async function POST(request: NextRequest): Promise<NextResponse<RefreshResponse>> {
  try {
    // 解析请求体
    const body: RefreshRequest = await request.json();
    const { refreshToken } = body;

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

    return NextResponse.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error("刷新令牌失败:", error);
    return NextResponse.json(
      { success: false, error: "刷新令牌失败，请稍后重试" },
      { status: 500 }
    );
  }
}
