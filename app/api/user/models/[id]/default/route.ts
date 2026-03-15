/**
 * 设置默认模型 API
 * PATCH: 将指定模型设为默认
 */

import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "@/lib/auth/middleware";
import { setDefaultUserModel } from "@/lib/db";

/**
 * PATCH 处理函数 - 设置默认模型
 */
export const PATCH = withOptionalAuth(async (request, context) => {
  try {
    // 获取路由参数
    const params = await request.nextUrl.pathname.match(/\/api\/user\/models\/([^\/]+)\/default$/) || [];
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

    // 设置默认模型
    const updatedModel = await setDefaultUserModel(context.userId, id);

    if (!updatedModel) {
      return NextResponse.json(
        {
          success: false,
          error: "模型不存在或设置默认失败",
        },
        { status: 404 }
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
        created_at: updatedModel.created_at,
        updated_at: updatedModel.updated_at,
      },
    });
  } catch (error) {
    console.error("设置默认模型失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "设置默认模型失败",
      },
      { status: 500 }
    );
  }
});
