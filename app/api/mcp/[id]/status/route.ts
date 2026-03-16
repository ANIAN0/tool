/**
 * MCP服务器状态检查API路由
 * 提供MCP服务器连接状态检测和工具列表获取
 */

import { type NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/middleware";
import type { McpStatusResult } from "@/lib/db/schema";

/**
 * 检查MCP服务器连接状态
 * 尝试连接服务器并返回状态信息
 * @param url - MCP服务器URL
 * @returns 状态检查结果
 */
async function checkMcpServerStatus(url: string): Promise<McpStatusResult> {
  const startTime = Date.now();

  try {
    // 尝试连接MCP服务器的根路径或健康检查端点
    // MCP Streamable HTTP服务器通常支持GET请求获取服务器信息
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        online: true,
        responseTime,
      };
    }

    // 服务器响应但返回错误状态码
    return {
      online: false,
      error: `服务器返回错误: ${response.status} ${response.statusText}`,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // 处理超时错误
    if (error instanceof Error && error.name === "AbortError") {
      return {
        online: false,
        error: "连接超时（超过10秒）",
        responseTime,
      };
    }

    // 处理其他连接错误
    return {
      online: false,
      error: error instanceof Error ? error.message : "未知错误",
      responseTime,
    };
  }
}

/**
 * 从MCP服务器获取工具列表
 * 实际实现需要调用MCP的tool/list方法
 * @param url - MCP服务器URL
 * @returns 工具列表
 */
async function fetchMcpTools(url: string): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> {
  try {
    // MCP协议中，tool/list通常通过POST请求到服务器端点
    // 实际实现需要根据具体的MCP服务器协议调整
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        method: "tools/list",
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    // MCP协议返回的工具列表格式
    return data.tools || [];
  } catch {
    // 获取工具列表失败时不阻塞，返回空数组
    return [];
  }
}

/**
 * 更新服务器状态到数据库
 * @param serverId - 服务器ID
 * @param status - 状态（online/offline/error）
 * @param errorMessage - 错误信息
 */
async function updateServerStatus(
  serverId: string,
  status: "online" | "offline" | "error",
  errorMessage: string | null
): Promise<void> {
  const client = await getClient();
  const now = Date.now();

  await client.execute({
    sql: `
      UPDATE user_mcp_servers
      SET status = ?, error_message = ?, last_check_at = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [status, errorMessage || "", now, now, serverId],
  });
}

/**
 * 同步MCP工具到数据库
 * @param serverId - 服务器ID
 * @param tools - 从服务器获取的工具列表
 */
async function syncMcpTools(
  serverId: string,
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>
): Promise<void> {
  const client = await getClient();
  const now = Date.now();

  // 获取现有工具
  const existingResult = await client.execute({
    sql: `SELECT name FROM mcp_tools WHERE server_id = ?`,
    args: [serverId],
  });

  const existingNames = new Set(existingResult.rows.map((row) => String(row.name)));
  const newNames = new Set(tools.map((t) => t.name));

  // 删除不再存在的工具
  const toDelete = [...existingNames].filter((name) => !newNames.has(name));
  if (toDelete.length > 0) {
    for (const name of toDelete) {
      await client.execute({
        sql: `DELETE FROM mcp_tools WHERE server_id = ? AND name = ?`,
        args: [serverId, name],
      });
    }
  }

  // 更新或插入工具
  for (const tool of tools) {
    const name = tool.name;
    const description = tool.description || "";
    const inputSchema = tool.inputSchema
      ? JSON.stringify(tool.inputSchema)
      : JSON.stringify({ type: "object", properties: {} });

    if (existingNames.has(name)) {
      // 更新现有工具
      await client.execute({
        sql: `
          UPDATE mcp_tools
          SET description = ?, input_schema = ?, is_available = 1, updated_at = ?
          WHERE server_id = ? AND name = ?
        `,
        args: [description, inputSchema, now, serverId, name],
      });
    } else {
      // 插入新工具
      await client.execute({
        sql: `
          INSERT INTO mcp_tools (id, server_id, name, description, input_schema, is_available, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          generateToolId(serverId, name),
          serverId,
          name,
          description,
          inputSchema,
          1,
          now,
          now,
        ],
      });
    }
  }

  // 将服务器下所有未在列表中的工具标记为不可用
  if (tools.length > 0) {
    await client.execute({
      sql: `
        UPDATE mcp_tools
        SET is_available = 0, updated_at = ?
        WHERE server_id = ? AND name NOT IN (${tools.map(() => "?").join(",")})
      `,
      args: [now, serverId, ...tools.map((t) => t.name)],
    });
  }
}

/**
 * 生成工具ID
 * @param serverId - 服务器ID
 * @param toolName - 工具名称
 * @returns 工具ID
 */
function generateToolId(serverId: string, toolName: string): string {
  // 简单组合生成ID
  return `${serverId}:${toolName}`;
}

/**
 * 获取MCP服务器状态和工具列表
 * GET /api/mcp/[id]/status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const { id } = await params;

  const client = await getClient();

  try {
    // 查询服务器URL和启用状态
    const result = await client.execute({
      sql: `
        SELECT url, is_enabled FROM user_mcp_servers
        WHERE id = ? AND user_id = ?
      `,
      args: [id, userId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "MCP服务器不存在" },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const url = String(row.url);
    const isEnabled = Boolean(row.is_enabled);

    // 如果服务器被禁用，直接返回离线状态
    if (!isEnabled) {
      return NextResponse.json({
        status: "offline",
        error: "服务器已禁用",
        tools: [],
      });
    }

    // 检查服务器状态
    const statusResult = await checkMcpServerStatus(url);

    if (statusResult.online) {
      // 服务器在线，获取工具列表
      const tools = await fetchMcpTools(url);

      // 同步工具到数据库
      await syncMcpTools(id, tools);

      // 更新服务器状态为在线
      await updateServerStatus(id, "online", null);

      return NextResponse.json({
        status: "online",
        responseTime: statusResult.responseTime,
        tools,
      });
    }

    // 服务器离线或出错
    const status: "offline" | "error" = statusResult.error ? "error" : "offline";
    await updateServerStatus(id, status, statusResult.error || null);

    return NextResponse.json({
      status,
      error: statusResult.error,
      tools: [],
    });
  } catch (error) {
    console.error("检查MCP服务器状态失败:", error);
    return NextResponse.json(
      { error: "检查MCP服务器状态失败" },
      { status: 500 }
    );
  }
}
