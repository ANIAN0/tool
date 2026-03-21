/**
 * MCP服务器工具列表API路由
 * 提供从缓存中获取MCP服务器提供的工具列表
 */

import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { authenticateRequestOptional } from "@/lib/auth/middleware";
import type { McpTool } from "@/lib/db/schema";

/**
 * 获取MCP服务器工具列表
 * GET /api/mcp/[id]/tools
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户身份（支持匿名用户）
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const { id } = await params;

  const client = getDb();

  try {
    // 验证服务器是否存在且属于当前用户
    const serverResult = await client.execute({
      sql: `
        SELECT id, name, status FROM user_mcp_servers
        WHERE id = ? AND user_id = ?
      `,
      args: [id, userId],
    });

    if (serverResult.rows.length === 0) {
      return NextResponse.json(
        { error: "MCP服务器不存在" },
        { status: 404 }
      );
    }

    const serverRow = serverResult.rows[0];
    const server = {
      id: String(serverRow.id),
      name: String(serverRow.name),
      status: String(serverRow.status),
    };

    // 从数据库获取工具列表
    const toolsResult = await client.execute({
      sql: `
        SELECT
          id,
          server_id,
          name,
          description,
          input_schema,
          is_available,
          created_at,
          updated_at
        FROM mcp_tools
        WHERE server_id = ?
        ORDER BY name ASC
      `,
      args: [id],
    });

    // 转换数据库结果为应用类型
    const tools: McpTool[] = toolsResult.rows.map((row) => ({
      id: String(row.id),
      server_id: String(row.server_id),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      input_schema: row.input_schema ? String(row.input_schema) : null,
      is_available: Boolean(row.is_available),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    }));

    return NextResponse.json({
      server,
      tools,
    });
  } catch (error) {
    console.error("获取MCP工具列表失败:", error);
    return NextResponse.json(
      { error: "获取MCP工具列表失败" },
      { status: 500 }
    );
  }
}
