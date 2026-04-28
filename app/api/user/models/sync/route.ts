/**
 * 匿名模型同步 API
 * POST: 将匿名用户的本地模型同步到数据库
 *
 * 使用场景：
 * - 匿名用户登录后，将 localStorage 中的模型同步到数据库
 * - 支持批量导入多个模型
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/infra/user/middleware";
import {
  getUserModels,
  createUserModel,
  setDefaultUserModel,
  type CreateUserModelParams,
} from "@/lib/db";
import { encryptApiKey } from "@/lib/encryption";
import { nanoid } from "nanoid";

// 同步请求中的单个模型数据
interface SyncModelData {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isDefault?: boolean;
}

/**
 * POST 处理函数 - 同步匿名模型
 */
export const POST = withAuth(async (request, context): Promise<NextResponse> => {
  try {
    const body = await request.json();

    // 验证请求体
    if (!body.models || !Array.isArray(body.models)) {
      return NextResponse.json(
        {
          success: false,
          error: "models 数组是必填项",
        },
        { status: 400 }
      );
    }

    const modelsToSync: SyncModelData[] = body.models;

    if (modelsToSync.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "至少需要一个模型",
        },
        { status: 400 }
      );
    }

    // 获取用户现有的模型（用于检查重复）
    const existingModels = await getUserModels(context.userId);
    const existingNames = new Set(existingModels.map((m) => m.name.toLowerCase()));

    const results = {
      success: [] as { name: string; id: string }[],
      failed: [] as { name: string; error: string }[],
      skipped: [] as { name: string; reason: string }[],
    };

    let defaultModelId: string | null = null;

    // 批量导入模型
    for (const modelData of modelsToSync) {
      try {
        // 验证必填字段
        if (!modelData.name || !modelData.provider || !modelData.model || !modelData.apiKey) {
          results.failed.push({
            name: modelData.name || "unknown",
            error: "缺少必填字段",
          });
          continue;
        }

        // 强制仅允许 openai，防止通过同步接口写入其他 provider
        if (modelData.provider.trim() !== "openai") {
          results.failed.push({
            name: modelData.name || "unknown",
            error: "当前仅支持 OpenAI-Compatible（provider=openai）",
          });
          continue;
        }

        // 检查是否已存在同名模型
        if (existingNames.has(modelData.name.toLowerCase())) {
          results.skipped.push({
            name: modelData.name,
            reason: "已存在同名模型",
          });
          continue;
        }

        // 加密 API Key
        const encryptedApiKey = encryptApiKey(modelData.apiKey);

        // 创建模型参数
        const params: CreateUserModelParams = {
          id: nanoid(),
          userId: context.userId,
          name: modelData.name.trim(),
          // 这里保持显式写入 openai，确保入库数据与系统能力一致
          provider: "openai",
          model: modelData.model.trim(),
          apiKey: encryptedApiKey,
          baseUrl: modelData.baseUrl?.trim() || undefined,
          isDefault: modelData.isDefault === true,
        };

        // 创建模型
        const newModel = await createUserModel(params);
        results.success.push({
          name: newModel.name,
          id: newModel.id,
        });

        // 记录默认模型ID
        if (modelData.isDefault) {
          defaultModelId = newModel.id;
        }

        // 添加到已存在集合，防止重复创建
        existingNames.add(modelData.name.toLowerCase());
      } catch (error) {
        results.failed.push({
          name: modelData.name || "unknown",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 如果有默认模型，确保它被正确设置
    //（createUserModel 已经处理了默认逻辑，这里只是额外保险）
    if (defaultModelId) {
      await setDefaultUserModel(context.userId, defaultModelId);
    }

    return NextResponse.json({
      success: true,
      data: {
        imported: results.success.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
        details: results,
      },
    });
  } catch (error) {
    console.error("同步匿名模型失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "同步失败",
      },
      { status: 500 }
    );
  }
});
