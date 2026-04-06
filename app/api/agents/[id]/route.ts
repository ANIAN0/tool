/**
 * Agent详情管理API路由
 * 提供单个Agent的查询、更新和删除操作
 *
 * GET: 获取Agent详情（公开Agent所有人可见，私有仅创建者可见）
 * PUT: 更新Agent（仅创建者）
 * DELETE: 删除Agent（仅创建者）
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequestOptional, authenticateRequest } from "@/lib/auth/middleware";
import {
  getAgentById,
  updateAgent,
  updateAgentWithSkills,
  deleteAgent,
  isAgentCreator,
  getAgentSkillsInfo,
} from "@/lib/db/agents";
import { validateTemplateConfig } from "@/lib/agents/templates";
import type { UpdateAgentParams } from "@/lib/db/schema";

/**
 * GET /api/agents/[id]
 * 获取Agent详情
 * 公开Agent所有人可见，私有Agent仅创建者可见
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户身份（支持匿名用户）
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const { id } = await params;

  try {
    // 🚀 性能优化：提前启动 skills Promise（使用 id，不依赖 agent 查询结果）
    const skillsPromise = getAgentSkillsInfo(id);

    // 获取Agent详情，getAgentById会自动检查权限
    // 公开Agent所有人可见，私有Agent仅创建者可见
    const agent = await getAgentById(id, userId);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent不存在或无权访问" },
        { status: 404 }
      );
    }

    // 解析template_config JSON字符串（同步操作）
    let templateConfig = null;
    if (agent.template_config) {
      try {
        templateConfig = JSON.parse(agent.template_config);
      } catch {
        templateConfig = null;
      }
    }

    // 等待 skills Promise 完成（可能已在 agent 查询期间完成）
    const skills = await skillsPromise;

    // 返回Agent详情
    return NextResponse.json({
      success: true,
      data: {
        ...agent,
        template_config: templateConfig,
        skills, // 新增：关联的 Skill 列表
      },
    });
  } catch (error) {
    console.error("获取Agent详情失败:", error);
    return NextResponse.json(
      { success: false, error: "获取Agent详情失败" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]
 * 更新Agent配置
 * 仅创建者可以更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户身份（必须登录）
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const { id } = await params;

  try {
    // 检查是否为创建者
    const isCreator = await isAgentCreator(userId, id);
    if (!isCreator) {
      return NextResponse.json(
        { success: false, error: "只有创建者才能更新Agent" },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 调试日志：查看 API 收到的请求体
    console.log("=== [API PUT /api/agents/[id]] 收到的请求体 ===");
    console.log("body.skillIds:", body.skillIds);
    console.log("body.enabledSystemTools:", body.enabledSystemTools);
    console.log("完整 body:", JSON.stringify(body, null, 2));

    // 构建更新参数
    const updateParams: UpdateAgentParams = {};

    // 更新名称
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return NextResponse.json(
          { success: false, error: "Agent名称不能为空" },
          { status: 400 }
        );
      }
      updateParams.name = body.name.trim();
    }

    // 更新描述
    if (body.description !== undefined) {
      updateParams.description = body.description?.trim() || null;
    }

    // 更新模板ID
    if (body.templateId !== undefined) {
      if (typeof body.templateId !== "string" || body.templateId.trim() === "") {
        return NextResponse.json(
          { success: false, error: "模板ID不能为空" },
          { status: 400 }
        );
      }
      updateParams.templateId = body.templateId.trim();
    }

    // 更新模板配置
    if (body.templateConfig !== undefined) {
      // 验证模板配置
      const templateId = body.templateId || (await getAgentById(id, userId))?.template_id;
      if (templateId) {
        const validation = validateTemplateConfig(templateId, body.templateConfig);
        if (!validation.valid) {
          return NextResponse.json(
            { success: false, error: validation.error },
            { status: 400 }
          );
        }
      }
      updateParams.templateConfig = body.templateConfig;
    }

    // 更新系统提示词
    if (body.systemPrompt !== undefined) {
      updateParams.systemPrompt = body.systemPrompt?.trim() || null;
    }

    // 更新关联模型
    if (body.modelId !== undefined) {
      updateParams.modelId = body.modelId?.trim() || null;
    }

    // 更新工具关联
    if (body.toolIds !== undefined) {
      if (!Array.isArray(body.toolIds)) {
        return NextResponse.json(
          { success: false, error: "toolIds必须是数组" },
          { status: 400 }
        );
      }
      updateParams.toolIds = body.toolIds;
    }

    // 更新启用的系统工具
    if (body.enabledSystemTools !== undefined) {
      if (!Array.isArray(body.enabledSystemTools)) {
        return NextResponse.json(
          { success: false, error: "enabledSystemTools必须是数组" },
          { status: 400 }
        );
      }
      updateParams.enabledSystemTools = body.enabledSystemTools;
    }

    // 提取 skillIds（单独处理）
    const skillIds = body.skillIds;

    // 执行更新（支持 Skill 关联）
    const updatedAgent = await updateAgentWithSkills(userId, id, updateParams, skillIds);

    if (!updatedAgent) {
      return NextResponse.json(
        { success: false, error: "更新Agent失败" },
        { status: 500 }
      );
    }

    // 解析template_config JSON字符串
    let templateConfig = null;
    if (updatedAgent.template_config) {
      try {
        templateConfig = JSON.parse(updatedAgent.template_config);
      } catch {
        templateConfig = null;
      }
    }

    // 返回更新后的Agent
    return NextResponse.json({
      success: true,
      data: {
        ...updatedAgent,
        template_config: templateConfig,
      },
    });
  } catch (error) {
    console.error("更新Agent失败:", error);
    return NextResponse.json(
      { success: false, error: "更新Agent失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]
 * 删除Agent
 * 仅创建者可以删除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户身份（必须登录）
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const { id } = await params;

  try {
    // 检查是否为创建者
    const isCreator = await isAgentCreator(userId, id);
    if (!isCreator) {
      return NextResponse.json(
        { success: false, error: "只有创建者才能删除Agent" },
        { status: 403 }
      );
    }

    // 执行删除
    const deleted = await deleteAgent(userId, id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "删除Agent失败" },
        { status: 500 }
      );
    }

    // 返回成功消息
    return NextResponse.json({
      success: true,
      message: "Agent已删除",
    });
  } catch (error) {
    console.error("删除Agent失败:", error);
    return NextResponse.json(
      { success: false, error: "删除Agent失败" },
      { status: 500 }
    );
  }
}