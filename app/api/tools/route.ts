/**
 * 统一工具列表API路由
 * 提供系统工具和MCP工具的合并列表
 */

import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { authenticateRequestOptional } from "@/lib/infra/user/middleware";
import type { Tool } from "@/lib/schemas";
import { SYSTEM_TOOLS_META } from "@/lib/infra/tools/system";

/**
 * 获取所有可用工具
 * GET /api/tools
 */
export async function GET(request: NextRequest) {
  // 验证用户身份（支持匿名用户）
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const client = getDb();

  try {
    // 构建系统工具列表（直接使用常量，isAvailable 始终为 true）
    const systemTools = [...SYSTEM_TOOLS_META];

    // 从数据库获取MCP工具（包含服务器信息）
    const mcpToolsResult = await client.execute({
      sql: `
        SELECT
          mt.id,
          mt.name,
          mt.description,
          mt.input_schema,
          mt.is_available,
          ums.id as server_id,
          ums.name as server_name,
          ums.status as server_status
        FROM mcp_tools mt
        JOIN user_mcp_servers ums ON mt.server_id = ums.id
        WHERE ums.user_id = ? AND ums.is_enabled = 1
        ORDER BY ums.name ASC, mt.name ASC
      `,
      args: [userId],
    });

    // 转换MCP工具数据
    const mcpTools: Tool[] = mcpToolsResult.rows.map((row) => {
      const isServerOnline = String(row.server_status) === "online";
      const isToolAvailable = Boolean(row.is_available) && isServerOnline;

      let inputSchema: Record<string, unknown> = {};
      try {
        if (row.input_schema) {
          inputSchema = JSON.parse(String(row.input_schema));
        }
      } catch {
        // 解析失败时使用空对象
        inputSchema = {};
      }

      return {
        id: String(row.id),
        name: String(row.name),
        description: row.description ? String(row.description) : "",
        inputSchema,
        source: "mcp" as const,
        server: {
          id: String(row.server_id),
          name: String(row.server_name),
        },
        isAvailable: isToolAvailable,
      };
    });

    // 合并工具列表：系统工具优先，然后是 MCP 工具
    // MCP 工具按 name 排序
    mcpTools.sort((a, b) => a.name.localeCompare(b.name));
    const tools = [...systemTools, ...mcpTools];

    // 计算统计数据
    const stats = {
      total: tools.length,
      system: systemTools.length,
      mcp: mcpTools.length,
      available: systemTools.length + mcpTools.filter((t) => t.isAvailable).length,
    };

    return NextResponse.json({
      tools,
      stats,
    });
  } catch (error) {
    console.error("获取工具列表失败:", error);
    return NextResponse.json(
      { error: "获取工具列表失败" },
      { status: 500 }
    );
  }
}
