import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  validatePasswordStrength,
  validateUsername,
  generateTokenPair,
} from "@/lib/infra/user";
import { getUserByUsername, createUser } from "@/lib/db/users";

// 邀请码从环境变量获取
const INVITE_CODE = process.env.INVITE_CODE;

// 注册请求类型
interface RegisterRequest {
  username: string;
  password: string;
  inviteCode: string;
}

// 注册响应类型
interface RegisterResponse {
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
 * 注册API
 * POST /api/auth/register
 *
 * 功能：
 * 1. 验证邀请码
 * 2. 验证用户名和密码格式
 * 3. 检查用户名是否已存在
 * 4. 创建新用户
 * 5. 返回JWT令牌对
 *
 * 注意：本系统不再支持匿名用户升级，所有用户必须通过注册创建
 */
export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    // 解析请求体
    const body: RegisterRequest = await request.json();
    const { username, password, inviteCode } = body;

    // 验证邀请码
    if (!INVITE_CODE) {
      return NextResponse.json(
        { success: false, error: "服务端未配置邀请码" },
        { status: 500 }
      );
    }

    if (inviteCode !== INVITE_CODE) {
      return NextResponse.json(
        { success: false, error: "邀请码无效" },
        { status: 400 }
      );
    }

    // 验证用户名格式
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return NextResponse.json(
        { success: false, error: usernameValidation.errors[0] },
        { status: 400 }
      );
    }

    // 验证密码强度
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "用户名已被使用" },
        { status: 400 }
      );
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 生成新的用户ID
    const newUserId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // 创建新用户
    const user = await createUser(newUserId, username, passwordHash);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "注册失败，请稍后重试" },
        { status: 500 }
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
    console.error("注册失败:", error);
    return NextResponse.json(
      { success: false, error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}