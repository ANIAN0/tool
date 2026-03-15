/**
 * 用户模型列表和创建 API
 * GET: 获取用户的所有模型
 * POST: 创建新模型
 */

import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "@/lib/auth/middleware";
import {
  getUserModels,
  createUserModel,
  type CreateUserModelParams,
} from "@/lib/db";
import { encryptApiKey } from "@/lib/encryption";
import { nanoid } from "nanoid";

/**
 * GET 处理函数 - 获取用户模型列表
 */
export const GET = withOptionalAuth(async (request, context) => {
  try {
    const models = await getUserModels(context.userId);

    // 返回模型列表，隐藏 API Key
    const safeModels = models.map((model) => ({
      id: model.id,
      user_id: model.user_id,
      name: model.name,
      provider: model.provider,
      model: model.model,
      base_url: model.base_url,
      is_default: model.is_default,
      created_at: model.created_at,
      updated_at: model.updated_at,
      // 不返回 api_key 字段
    }));

    return NextResponse.json({
      success: true,
      data: safeModels,
    });
  } catch (error) {
    console.error("获取用户模型失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取模型列表失败",
      },
      { status: 500 }
    );
  }
});

/**
 * POST 处理函数 - 创建新模型
 */
export const POST = withOptionalAuth(async (request, context) => {
  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "模型名称是必填项",
        },
        { status: 400 }
      );
    }

    if (!body.provider || typeof body.provider !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Provider 是必填项",
        },
        { status: 400 }
      );
    }

    if (!body.model || typeof body.model !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Model ID 是必填项",
        },
        { status: 400 }
      );
    }

    if (!body.apiKey || typeof body.apiKey !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "API Key 是必填项",
        },
        { status: 400 }
      );
    }

    // 加密 API Key
    const encryptedApiKey = encryptApiKey(body.apiKey);

    // 创建模型参数
    const params: CreateUserModelParams = {
      id: nanoid(),
      userId: context.userId,
      name: body.name.trim(),
      provider: body.provider.trim(),
      model: body.model.trim(),
      apiKey: encryptedApiKey,
      baseUrl: body.baseUrl?.trim() || undefined,
      isDefault: body.isDefault === true,
    };

    // 创建模型
    const newModel = await createUserModel(params);

    // 返回创建成功的模型（隐藏 API Key）
    return NextResponse.json({
      success: true,
      data: {
        id: newModel.id,
        user_id: newModel.user_id,
        name: newModel.name,
        provider: newModel.provider,
        model: newModel.model,
        base_url: newModel.base_url,
        is_default: newModel.is_default,
        created_at: newModel.created_at,
        updated_at: newModel.updated_at,
      },
    });
  } catch (error) {
    console.error("创建用户模型失败:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "创建模型失败",
      },
      { status: 500 }
    );
  }
});
