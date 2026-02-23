import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  validatePasswordStrength,
  validateUsername,
  generateTokenPair,
} from "@/lib/auth";
import { getUserById, getUserByUsername, upgradeToRegisteredUser, createAnonymousUser } from "@/lib/db/users";

// 邀请码从环境变量获取
const INVITE_CODE = process.env.INVITE_CODE;

// 注册请求类型
interface RegisterRequest {
  username: string;
  password: string;
  inviteCode: string;
  anonymousId?: string; // 当前匿名用户ID，用于升级
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
 * 4. 如果提供匿名ID，升级匿名用户；否则创建新用户
 * 5. 返回JWT令牌对
 */
export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    // 解析请求体
    const body: RegisterRequest = await request.json();
    const { username, password, inviteCode, anonymousId } = body;

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

    let user;

    if (anonymousId) {
      // 检查匿名用户是否存在
      const existingAnonUser = await getUserById(anonymousId);
      
      if (existingAnonUser) {
        // 匿名用户存在，直接升级
        user = await upgradeToRegisteredUser(anonymousId, username, passwordHash);
      } else {
        // 匿名用户不存在（从未与后端交互），创建新用户并保留该ID
        // 这样可以保留该匿名ID的对话历史
        user = await upgradeToRegisteredUser(anonymousId, username, passwordHash);
        
        // 如果用户不存在（可能是ID冲突），先创建匿名用户再升级
        if (!user) {
          await createAnonymousUser(anonymousId);
          user = await upgradeToRegisteredUser(anonymousId, username, passwordHash);
        }
      }
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: "注册失败，请稍后重试" },
          { status: 500 }
        );
      }
    } else {
      // 没有匿名ID，创建全新用户
      // 生成新的用户ID
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      user = await upgradeToRegisteredUser(newUserId, username, passwordHash);
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: "注册失败，请稍后重试" },
          { status: 500 }
        );
      }
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
