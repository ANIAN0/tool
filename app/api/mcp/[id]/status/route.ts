/**
 * MCP服务器状态检查API路由
 * 提供MCP服务器连接状态检测和工具列表获取
 */

import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { authenticateRequestOptional } from "@/lib/infra/user/middleware";
import type { McpStatusResult } from "@/lib/schemas";
import { createMCPClient } from "@ai-sdk/mcp";

/**
 * 检查MCP服务器连接状态
 * 使用 @ai-sdk/mcp SDK 尝试连接服务器并返回状态信息
 * @param url - MCP服务器URL
 * @param headers - 可选的自定义请求头
 * @returns 状态检查结果
 */
async function checkMcpServerStatus(
  url: string,
  headers?: Record<string, string>
): Promise<McpStatusResult> {
  const startTime = Date.now();
  let mcpClient: { tools: () => Promise<unknown>; close: () => Promise<void> } | null = null;

  try {
    // 使用 @ai-sdk/mcp SDK 创建客户端
    // SDK 会自动处理完整的协议握手流程（initialize → initialized → tools/list）
    mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url,
        headers,  // 传递自定义 headers
      },
    });

    // SDK 内部已经完成了 initialize 和 notifications/initialized
    // 现在可以直接获取工具列表
    const tools = await mcpClient.tools();
    const responseTime = Date.now() - startTime;

    return {
      online: true,
      responseTime,
      toolsCount: Object.keys(tools as Record<string, unknown>).length,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      online: false,
      error: error instanceof Error ? error.message : "未知错误",
      responseTime,
    };
  } finally {
    // 确保关闭客户端
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}

/**
 * 从MCP服务器获取工具列表
 * 使用 @ai-sdk/mcp SDK 获取工具列表
 * @param url - MCP服务器URL
 * @param headers - 可选的自定义请求头
 * @returns 工具列表
 */
async function fetchMcpTools(
  url: string,
  headers?: Record<string, string>
): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> {
  let mcpClient: { tools: () => Promise<unknown>; close: () => Promise<void> } | null = null;

  try {
    mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url,
        headers,
      },
    });

    const tools = await mcpClient.tools();

    // 转换 SDK 返回的工具格式为项目需要的格式
    const toolsArray: Array<{ name: string; description?: string; inputSchema?: unknown }> = [];

    for (const [name, tool] of Object.entries(tools as Record<string, { description?: string; inputSchema?: unknown }>)) {
      toolsArray.push({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }

    return toolsArray;
  } catch (error) {
    console.error("获取MCP工具列表失败:", error);
    return [];
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }
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
  const client = getDb();
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
  tools: Array<{ name: string; description?: string; inputSchema?: unknown; parameters?: unknown }>
): Promise<void> {
  const client = getDb();
  const now = Date.now();

  console.log(`同步 ${tools.length} 个工具到数据库，服务器ID: ${serverId}`);

  // 获取现有工具
  const existingResult = await client.execute({
    sql: `SELECT name FROM mcp_tools WHERE server_id = ?`,
    args: [serverId],
  });

  const existingNames = new Set(existingResult.rows.map((row) => String(row.name)));
  const newNames = new Set(tools.map((t) => t.name));

  console.log(`现有工具: ${existingNames.size} 个，新工具: ${newNames.size} 个`);

  // 删除不再存在的工具
  const toDelete = [...existingNames].filter((name) => !newNames.has(name));
  if (toDelete.length > 0) {
    for (const name of toDelete) {
      await client.execute({
        sql: `DELETE FROM mcp_tools WHERE server_id = ? AND name = ?`,
        args: [serverId, name],
      });
    }
    console.log(`删除 ${toDelete.length} 个不再存在的工具`);
  }

  // 更新或插入工具
  for (const tool of tools) {
    const name = tool.name;
    const description = tool.description || "";

    // 获取原始 schema（兼容 inputSchema 和 parameters 两种字段名）
    let rawSchema = tool.inputSchema || tool.parameters;

    // SDK 返回的 inputSchema 可能被包装在 jsonSchema 字段中
    // 例如：{ jsonSchema: { type: "object", properties: {...} } }
    // 需要提取内部的真正 schema
    if (rawSchema && typeof rawSchema === 'object' && 'jsonSchema' in rawSchema) {
      rawSchema = (rawSchema as { jsonSchema: unknown }).jsonSchema;
    }

    // 最终 schema，如果都没有则使用空对象
    const schema = rawSchema || { type: "object", properties: {} };
    const inputSchema = JSON.stringify(schema);

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
      console.log(`插入新工具: ${name}`);
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

  console.log(`工具同步完成`);
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
    // 查询服务器URL和启用状态
    const result = await client.execute({
      sql: `
        SELECT url, is_enabled, headers FROM user_mcp_servers
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
    // 从数据库解析 headers（存储为 JSON 字符串）
    const headersJson = row.headers ? String(row.headers) : null;
    const headers = headersJson ? JSON.parse(headersJson) : undefined;

    // 如果服务器被禁用，直接返回离线状态
    if (!isEnabled) {
      return NextResponse.json({
        status: "offline",
        error: "服务器已禁用",
        tools: [],
      });
    }

    // 检查服务器状态，传递 headers 支持认证
    const statusResult = await checkMcpServerStatus(url, headers);

    if (statusResult.online) {
      // 服务器在线，获取工具列表，传递 headers
      const tools = await fetchMcpTools(url, headers);

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
