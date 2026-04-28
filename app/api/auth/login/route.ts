import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, generateTokenPair } from "@/lib/infra/user";
import { getUserByUsername } from "@/lib/db/users";

// Cookie 配置常量
const COOKIE_CONFIG = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  // Cookie 有效期（秒）
  ACCESS_TOKEN_MAX_AGE: 60 * 15, // 15分钟，与 JWT 有效期同步
  REFRESH_TOKEN_MAX_AGE: 60 * 60 * 24 * 7, // 7天，与 JWT 有效期同步
};

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

    // 检查是否为认证用户（非匿名）
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

    // 创建响应对象
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username!,
        isAnonymous: user.is_anonymous,
      },
      accessToken,
      refreshToken,
    });

    // 设置 cookie 存储 token，供 Server Component 和 middleware 使用
    response.cookies.set(COOKIE_CONFIG.ACCESS_TOKEN, accessToken, {
      httpOnly: true, // 防止 XSS 攻击
      secure: process.env.NODE_ENV === "production", // 生产环境启用 HTTPS
      sameSite: "lax", // 防止 CSRF 攻击
      maxAge: COOKIE_CONFIG.ACCESS_TOKEN_MAX_AGE,
      path: "/", // 全站可用
    });

    response.cookies.set(COOKIE_CONFIG.REFRESH_TOKEN, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("登录失败:", error);
    return NextResponse.json(
      { success: false, error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}