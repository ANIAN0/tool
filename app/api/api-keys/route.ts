/**
 * API Key 管理 API
 * 提供列表获取和创建功能
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isRegisteredUser } from "@/lib/auth/middleware";
import {
  getUserApiKeysByUserId,
  createUserApiKey,
  generateApiKey,
} from "@/lib/db/api-keys";
import { generateId } from "@/lib/utils";

/**
 * 统一错误响应格式
 */
function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

/**
 * 获取 API Key 列表
 * GET /api/api-keys
 */
export async function GET(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  try {
    // 获取用户的 API Key 列表
    const apiKeys = await getUserApiKeysByUserId(userId);

    return NextResponse.json({
      apiKeys: apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
      })),
    });
  } catch (error) {
    console.error("获取 API Key 列表失败:", error);
    return errorResponse("INTERNAL_ERROR", "获取 API Key 列表失败", 500);
  }
}

/**
 * 创建新 API Key
 * POST /api/api-keys
 */
export async function POST(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  // 验证用户是否为注册用户
  const isRegistered = await isRegisteredUser(userId);
  if (!isRegistered) {
    return errorResponse("FORBIDDEN", "仅支持注册用户创建 API Key", 403);
  }

  try {
    // 解析请求体
    const body = await request.json();
    const { name } = body;

    // 验证名称
    if (!name || typeof name !== "string" || name.trim() === "") {
      return errorResponse("VALIDATION_ERROR", "API Key 名称不能为空", 400);
    }

    // 生成 ID 和 Key
    const apiKeyId = generateId();
    const fullKey = generateApiKey();

    // 创建 API Key（存储哈希）
    await createUserApiKey(
      {
        id: apiKeyId,
        userId,
        name: name.trim(),
      },
      fullKey // 完整 Key 用于计算哈希
    );

    // 返回结果（完整 Key 仅此一次可见）
    return NextResponse.json(
      {
        success: true,
        data: {
          id: apiKeyId,
          name: name.trim(),
          key: fullKey, // 完整 Key，提示用户保存
          warning: "请妥善保存此 Key，关闭后将无法再次查看完整内容",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("创建 API Key 失败:", error);
    return errorResponse("INTERNAL_ERROR", "创建 API Key 失败", 500);
  }
}