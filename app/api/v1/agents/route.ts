/**
 * 对外 Agent 列表接口
 * GET /api/v1/agents
 * 返回用户可访问的 Agent 列表（用户创建 + 公开的 Agent）
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/infra/user/api-key";
import { getAgentsByUserId, getPublicAgents } from "@/lib/db/agents";

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
 * 获取可用的 Agent 列表
 */
export async function GET(request: NextRequest) {
  // 验证 API Key
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) {
    return apiKeyErrorResponse(authResult);
  }

  const userId = authResult.userId;

  try {
    // 获取用户的 Agent 和公开 Agent
    const [myAgents, publicAgents] = await Promise.all([
      getAgentsByUserId(userId),
      getPublicAgents(userId),
    ]);

    // 合并并去重（用户可能同时拥有私有和公开 Agent）
    const allAgents = [...myAgents, ...publicAgents];
    const uniqueAgents = Array.from(
      new Map(allAgents.map((a) => [a.id, a])).values()
    );

    return NextResponse.json({
      agents: uniqueAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        isPublic: agent.is_public,
        isOwner: agent.user_id === userId,
      })),
    });
  } catch (error) {
    console.error("获取 Agent 列表失败:", error);
    return errorResponse("INTERNAL_ERROR", "获取 Agent 列表失败", 500);
  }
}