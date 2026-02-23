import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, generateTokenPair } from "@/lib/auth";
import { getUserByUsername } from "@/lib/db/users";

// 登录请求类型
interface LoginRequest {
  username: string;
  password: string;
}

// 登录响应类型
interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    isAnonymous: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

/**
 * 登录API
 * POST /api/auth/login
 * 
 * 功能：
 * 1. 验证用户名和密码
 * 2. 返回JWT令牌对
 */
export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    // 解析请求体
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    // 验证必填字段
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await getUserByUsername(username);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 检查是否为认证用户
    if (user.is_anonymous) {
      return NextResponse.json(
        { success: false, error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 验证密码
    if (!user.password_hash) {
      return NextResponse.json(
        { success: false, error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 生成令牌对
    const { accessToken, refreshToken } = generateTokenPair(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username!,
        isAnonymous: user.is_anonymous,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("登录失败:", error);
    return NextResponse.json(
      { success: false, error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
