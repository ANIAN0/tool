/**
 * MCP服务器详情管理API路由
 * 提供单个MCP服务器的更新和删除操作
 */

import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/middleware";
import type { McpServer, McpStatus } from "@/lib/db/schema";

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
 * 获取单个MCP服务器详情
 * GET /api/mcp/[id]
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

  const client = getDb();

  try {
    // 查询指定ID的MCP服务器
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
        WHERE id = ? AND user_id = ?
      `,
      args: [id, userId],
    });

    // 服务器不存在
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "MCP服务器不存在" },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const server: McpServer = {
      id: String(row.id),
      user_id: String(row.user_id),
      name: String(row.name),
      url: String(row.url),
      headers: row.headers ? String(row.headers) : null,  // 新增 headers 字段
      status: String(row.status) as McpStatus,
      is_enabled: Boolean(row.is_enabled),
      last_check_at: row.last_check_at ? Number(row.last_check_at) : null,
      error_message: row.error_message ? String(row.error_message) : null,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    };

    return NextResponse.json({ server });
  } catch (error) {
    console.error("获取MCP服务器详情失败:", error);
    return NextResponse.json(
      { error: "获取MCP服务器详情失败" },
      { status: 500 }
    );
  }
}

/**
 * 更新MCP服务器配置
 * PUT /api/mcp/[id]
 */
export async function PUT(
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

  try {
    const body = await request.json();
    const { name, url, isEnabled, headers } = body;  // 提取 headers 字段

    const client = getDb();

    // 验证服务器是否存在且属于当前用户
    const existingResult = await client.execute({
      sql: `
        SELECT id FROM user_mcp_servers
        WHERE id = ? AND user_id = ?
      `,
      args: [id, userId],
    });

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { error: "MCP服务器不存在" },
        { status: 404 }
      );
    }

    // 构建更新字段
    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    // 更新名称
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "服务器名称不能为空" },
          { status: 400 }
        );
      }
      updates.push("name = ?");
      args.push(name.trim());
    }

    // 更新URL
    if (url !== undefined) {
      if (typeof url !== "string") {
        return NextResponse.json(
          { error: "服务器URL格式无效" },
          { status: 400 }
        );
      }
      if (!isValidUrl(url)) {
        return NextResponse.json(
          { error: "无效的URL格式，仅支持HTTP和HTTPS协议" },
          { status: 400 }
        );
      }
      updates.push("url = ?");
      args.push(url.trim());
      // URL变更时重置状态
      updates.push("status = ?");
      args.push("offline");
      updates.push("error_message = ?");
      args.push("");
    }

    // 更新启用状态
    if (isEnabled !== undefined) {
      updates.push("is_enabled = ?");
      args.push(isEnabled ? 1 : 0);
    }

    // 更新 headers
    if (headers !== undefined) {
      if (headers) {
        try {
          JSON.parse(headers);
          updates.push("headers = ?");
          args.push(headers);
        } catch {
          return NextResponse.json(
            { error: "headers 必须是有效的 JSON 字符串" },
            { status: 400 }
          );
        }
      } else {
        // headers 为空字符串时设为 NULL
        updates.push("headers = ?");
        args.push(null);
      }
    }

    // 如果没有要更新的字段
    if (updates.length === 0) {
      return NextResponse.json(
        { error: "没有提供要更新的字段" },
        { status: 400 }
      );
    }

    // 添加更新时间
    updates.push("updated_at = ?");
    args.push(Date.now());

    // 添加WHERE条件参数
    args.push(id);
    args.push(userId);

    // 执行更新
    await client.execute({
      sql: `
        UPDATE user_mcp_servers
        SET ${updates.join(", ")}
        WHERE id = ? AND user_id = ?
      `,
      args,
    });

    // 获取更新后的服务器信息
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
        WHERE id = ? AND user_id = ?
      `,
      args: [id, userId],
    });

    const row = result.rows[0];
    const server: McpServer = {
      id: String(row.id),
      user_id: String(row.user_id),
      name: String(row.name),
      url: String(row.url),
      headers: row.headers ? String(row.headers) : null,  // 新增 headers 字段
      status: String(row.status) as McpStatus,
      is_enabled: Boolean(row.is_enabled),
      last_check_at: row.last_check_at ? Number(row.last_check_at) : null,
      error_message: row.error_message ? String(row.error_message) : null,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    };

    return NextResponse.json({ server });
  } catch (error) {
    console.error("更新MCP服务器失败:", error);
    return NextResponse.json(
      { error: "更新MCP服务器失败" },
      { status: 500 }
    );
  }
}

/**
 * 删除MCP服务器配置
 * DELETE /api/mcp/[id]
 */
export async function DELETE(
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

  const client = getDb();

  try {
    // 验证服务器是否存在且属于当前用户
    const existingResult = await client.execute({
      sql: `
        SELECT id FROM user_mcp_servers
        WHERE id = ? AND user_id = ?
      `,
      args: [id, userId],
    });

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { error: "MCP服务器不存在" },
        { status: 404 }
      );
    }

    // 删除服务器（关联的工具会通过外键级联删除）
    await client.execute({
      sql: `
        DELETE FROM user_mcp_servers
        WHERE id = ? AND user_id = ?
      `,
      args: [id, userId],
    });

    return NextResponse.json(
      { message: "MCP服务器已删除" },
      { status: 200 }
    );
  } catch (error) {
    console.error("删除MCP服务器失败:", error);
    return NextResponse.json(
      { error: "删除MCP服务器失败" },
      { status: 500 }
    );
  }
}
