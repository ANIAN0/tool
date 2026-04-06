/**
 * 单个模型操作 API
 * GET: 获取单个模型详情
 * PUT: 更新模型
 * DELETE: 删除模型
 */

import { NextResponse } from "next/server";
import { withOptionalAuth } from "@/lib/auth/middleware";
import {
  getUserModelById,
  updateUserModel,
  deleteUserModel,
  type UpdateUserModelParams,
} from "@/lib/db";
import { encryptApiKey } from "@/lib/encryption";

/**
 * GET 处理函数 - 获取单个模型
 */
export const GET = withOptionalAuth(async (request, context): Promise<NextResponse> => {
  try {
    // 获取路由参数
    const params = await request.nextUrl.pathname.match(/\/api\/user\/models\/([^\/]+)$/) || [];
    const id = params[1];

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "模型ID是必填项",
        },
        { status: 400 }
      );
    }

    const model = await getUserModelById(context.userId, id);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          error: "模型不存在",
        },
        { status: 404 }
      );
    }

    // 返回模型详情（隐藏 API Key）
    return NextResponse.json({
      success: true,
      data: {
        id: model.id,
        user_id: model.user_id,
        name: model.name,
        provider: model.provider,
        model: model.model,
        base_url: model.base_url,
        is_default: model.is_default,
        context_limit: model.context_limit, // 新增：返回上下文上限
        created_at: model.created_at,
        updated_at: model.updated_at,
      },
    });
  } catch (error) {
    console.error("获取模型详情失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取模型详情失败",
      },
      { status: 500 }
    );
  }
});

/**
 * PUT 处理函数 - 更新模型
 */
export const PUT = withOptionalAuth(async (request, context): Promise<NextResponse> => {
  try {
    // 获取路由参数
    const params = await request.nextUrl.pathname.match(/\/api\/user\/models\/([^\/]+)$/) || [];
    const id = params[1];

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "模型ID是必填项",
        },
        { status: 400 }
      );
    }

    // 检查模型是否存在
    const existingModel = await getUserModelById(context.userId, id);
    if (!existingModel) {
      return NextResponse.json(
        {
          success: false,
          error: "模型不存在",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 构建更新参数
    const updateParams: UpdateUserModelParams = {};

    if (body.name !== undefined) {
      updateParams.name = body.name.trim();
    }

    if (body.provider !== undefined) {
      // 仅允许 openai，防止绕过前端写入其他 provider
      if (body.provider.trim() !== "openai") {
        return NextResponse.json(
          {
            success: false,
            error: "当前仅支持 OpenAI-Compatible（provider=openai）",
          },
          { status: 400 }
        );
      }
      updateParams.provider = body.provider.trim();
    }

    if (body.model !== undefined) {
      updateParams.model = body.model.trim();
    }

    if (body.apiKey !== undefined && body.apiKey !== "") {
      // 加密新的 API Key
      updateParams.apiKey = encryptApiKey(body.apiKey);
    }

    if (body.baseUrl !== undefined) {
      updateParams.baseUrl = body.baseUrl?.trim() || null;
    }

    if (body.isDefault !== undefined) {
      updateParams.isDefault = body.isDefault === true;
    }

    // 新增：上下文上限更新
    if (body.contextLimit !== undefined) {
      const parsedLimit = parseInt(body.contextLimit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        updateParams.contextLimit = parsedLimit;
      }
    }

    // 更新模型
    const updatedModel = await updateUserModel(context.userId, id, updateParams);

    if (!updatedModel) {
      return NextResponse.json(
        {
          success: false,
          error: "更新模型失败",
        },
        { status: 500 }
      );
    }

    // 返回更新后的模型（隐藏 API Key）
    return NextResponse.json({
      success: true,
      data: {
        id: updatedModel.id,
        user_id: updatedModel.user_id,
        name: updatedModel.name,
        provider: updatedModel.provider,
        model: updatedModel.model,
        base_url: updatedModel.base_url,
        is_default: updatedModel.is_default,
        context_limit: updatedModel.context_limit, // 新增：返回上下文上限
        created_at: updatedModel.created_at,
        updated_at: updatedModel.updated_at,
      },
    });
  } catch (error) {
    console.error("更新模型失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "更新模型失败",
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE 处理函数 - 删除模型
 */
export const DELETE = withOptionalAuth(async (request, context): Promise<NextResponse> => {
  try {
    // 获取路由参数
    const params = await request.nextUrl.pathname.match(/\/api\/user\/models\/([^\/]+)$/) || [];
    const id = params[1];

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "模型ID是必填项",
        },
        { status: 400 }
      );
    }

    // 检查模型是否存在
    const existingModel = await getUserModelById(context.userId, id);
    if (!existingModel) {
      return NextResponse.json(
        {
          success: false,
          error: "模型不存在",
        },
        { status: 404 }
      );
    }

    // 删除模型
    const deleted = await deleteUserModel(context.userId, id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: "删除模型失败",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "模型已删除",
    });
  } catch (error) {
    console.error("删除模型失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "删除模型失败",
      },
      { status: 500 }
    );
  }
});
