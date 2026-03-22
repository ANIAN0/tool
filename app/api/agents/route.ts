/**
 * Agent列表API路由
 * 提供Agent的列表获取和创建功能
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  authenticateRequestOptional,
  isRegisteredUser,
} from "@/lib/auth/middleware";
import {
  getAgentsByUserId,
  getPublicAgents,
  createAgent,
} from "@/lib/db/agents";
import { validateTemplateConfig } from "@/lib/agents/templates";
import { generateId } from "@/lib/utils";

/**
 * 获取Agent列表
 * GET /api/agents
 *
 * 已登录用户：返回 myAgents + publicAgents（排除自己的公开Agent）
 * 匿名用户：返回空的 myAgents + 所有 publicAgents
 */
export async function GET(request: NextRequest) {
  // 验证用户身份（支持匿名用户）
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    // 并行获取用户的Agent和公开Agent
    const [myAgents, publicAgents] = await Promise.all([
      getAgentsByUserId(userId), // 获取用户自己的Agent
      getPublicAgents(userId), // 获取公开Agent，排除当前用户的
    ]);

    return NextResponse.json({
      success: true,
      data: {
        myAgents,
        publicAgents,
      },
    });
  } catch (error) {
    console.error("获取Agent列表失败:", error);
    return NextResponse.json(
      { success: false, error: "获取Agent列表失败" },
      { status: 500 }
    );
  }
}

/**
 * 创建新Agent
 * POST /api/agents
 *
 * 仅限已登录用户
 */
export async function POST(request: NextRequest) {
  // 验证用户身份（必须登录）
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  // 验证用户是否为注册用户（非匿名）
  const isRegistered = await isRegisteredUser(userId);
  if (!isRegistered) {
    return NextResponse.json(
      { success: false, error: "仅支持注册用户创建Agent" },
      { status: 403 }
    );
  }

  try {
    // 解析请求体
    const body = await request.json();
    const { name, description, templateId, templateConfig, systemPrompt, modelId, toolIds } = body;

    // 验证必填字段：名称
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Agent名称不能为空" },
        { status: 400 }
      );
    }

    // 验证必填字段：模板ID
    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { success: false, error: "模板ID不能为空" },
        { status: 400 }
      );
    }

    // 验证模板配置（如果提供）
    if (templateConfig) {
      const validationResult = validateTemplateConfig(templateId, templateConfig);
      if (!validationResult.valid) {
        return NextResponse.json(
          { success: false, error: validationResult.error },
          { status: 400 }
        );
      }
    }

    // 生成Agent ID
    const agentId = generateId();

    // 创建Agent
    const agent = await createAgent({
      id: agentId,
      userId,
      name: name.trim(),
      description: description?.trim() || undefined,
      templateId,
      templateConfig: templateConfig || undefined,
      systemPrompt: systemPrompt?.trim() || undefined,
      modelId: modelId || undefined,
      toolIds: toolIds || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: agent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("创建Agent失败:", error);
    return NextResponse.json(
      { success: false, error: "创建Agent失败" },
      { status: 500 }
    );
  }
}