/**
 * Skill列表对外接口
 * GET /api/v1/skills
 * 使用 API Key 鉴权获取用户的Skill列表
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, apiKeyErrorResponse } from "@/lib/infra/user/api-key";
import { getUserSkillsByUserId } from "@/lib/db/skills";

/**
 * 获取用户的所有Skills
 * GET /api/v1/skills
 *
 * 返回用户的所有Skill列表，包含每个Skill关联的Agent数量
 * 使用API Key进行身份验证
 */
export async function GET(request: NextRequest) {
  // API Key 认证
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) {
    return apiKeyErrorResponse(authResult);
  }

  const userId = authResult.userId;

  try {
    // 获取用户的Skills列表（包含关联的Agent数量）
    const skills = await getUserSkillsByUserId(userId);

    // 返回简化的Skill信息，将数据库字段名转换为API规范命名
    return NextResponse.json({
      skills: skills.map(skill => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        agentCount: skill.agentCount,
        createdAt: skill.created_at,
        updatedAt: skill.updated_at,
      })),
    });
  } catch (error) {
    console.error("获取Skills失败:", error);
    return NextResponse.json(
      { error: "获取Skills失败" },
      { status: 500 }
    );
  }
}
