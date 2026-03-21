/**
 * MCP服务器管理API路由
 * 提供MCP服务器的CRUD操作和状态检查
 */

import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { authenticateRequestOptional } from "@/lib/auth/middleware";
import type { McpServer, CreateMcpServerParams, McpStatus } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

/**
 * 验证URL格式是否有效
 * @param url - 待验证的URL字符串
 * @returns 是否为有效的HTTP/HTTPS URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 获取用户的MCP服务器列表
 * GET /api/mcp
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
    // 查询用户的所有MCP服务器
    const result = await client.execute({
      sql: `
        SELECT
          id,
          user_id,
          name,
          url,
          headers,
          status,
          is_enabled,
          last_check_at,
          error_message,
          created_at,
          updated_at
        FROM user_mcp_servers
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      args: [userId],
    });

    // 转换数据库结果为应用类型
    const servers: McpServer[] = result.rows.map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      name: String(row.name),
      url: String(row.url),
      headers: row.headers ? String(row.headers) : null,
      status: String(row.status) as McpStatus,
      is_enabled: Boolean(row.is_enabled),
      last_check_at: row.last_check_at ? Number(row.last_check_at) : null,
      error_message: row.error_message ? String(row.error_message) : null,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    }));

    return NextResponse.json({ servers });
  } catch (error) {
    console.error("获取MCP服务器列表失败:", error);
    return NextResponse.json(
      { error: "获取MCP服务器列表失败" },
      { status: 500 }
    );
  }
}

/**
 * 创建新的MCP服务器配置
 * POST /api/mcp
 */
export async function POST(request: NextRequest) {
  // 验证用户身份（支持匿名用户）
  const authResult = await authenticateRequestOptional(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;

  try {
    const body = await request.json();
    const { name, url, headers } = body;  // 提取 headers

    // 验证必填字段
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "服务器名称不能为空" },
        { status: 400 }
      );
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "服务器URL不能为空" },
        { status: 400 }
      );
    }

    // 验证URL格式
    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: "无效的URL格式，仅支持HTTP和HTTPS协议" },
        { status: 400 }
      );
    }

    // 验证 headers 格式（如果提供）
    let headersJson: string | null = null;
    if (headers) {
      try {
        // 验证是否为有效的 JSON
        JSON.parse(headers);
        headersJson = headers;
      } catch {
        return NextResponse.json(
          { error: "headers 必须是有效的 JSON 字符串" },
          { status: 400 }
        );
      }
    }

    const client = getDb();
    const now = Date.now();

    // 创建新服务器配置
    const newServer: CreateMcpServerParams = {
      id: generateId(),
      userId,
      name: name.trim(),
      url: url.trim(),
    };

    await client.execute({
      sql: `
        INSERT INTO user_mcp_servers (
          id, user_id, name, url, headers, status, is_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        newServer.id,
        newServer.userId,
        newServer.name,
        newServer.url,
        headersJson,  // 新增
        "offline",
        1,
        now,
        now,
      ],
    });

    // 返回创建的服务器信息
    const server: McpServer = {
      id: newServer.id,
      user_id: newServer.userId,
      name: newServer.name,
      url: newServer.url,
      headers: headersJson,
      status: "offline",
      is_enabled: true,
      last_check_at: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    console.error("创建MCP服务器失败:", error);
    return NextResponse.json(
      { error: "创建MCP服务器失败" },
      { status: 500 }
    );
  }
}
