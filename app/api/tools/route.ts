/**
 * 统一工具列表API路由
 * 提供系统工具（硬编码）和MCP工具（来自缓存）的聚合列表
 */

import { type NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";
import { authenticateRequest } from "@/lib/auth/middleware";
import type { Tool } from "@/lib/db/schema";

// 系统内置工具定义
// 这些工具是系统原生支持的功能
const SYSTEM_TOOLS: Tool[] = [
  {
    id: "system:search",
    name: "search",
    description: "搜索网络信息",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索查询",
        },
      },
      required: ["query"],
    },
    source: "system",
    isAvailable: true,
  },
  {
    id: "system:readFile",
    name: "readFile",
    description: "读取文件内容",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径",
        },
      },
      required: ["path"],
    },
    source: "system",
    isAvailable: true,
  },
  {
    id: "system:writeFile",
    name: "writeFile",
    description: "写入文件内容",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径",
        },
        content: {
          type: "string",
          description: "文件内容",
        },
      },
      required: ["path", "content"],
    },
    source: "system",
    isAvailable: true,
  },
  {
    id: "system:listDirectory",
    name: "listDirectory",
    description: "列出目录内容",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "目录路径",
        },
      },
      required: ["path"],
    },
    source: "system",
    isAvailable: true,
  },
  {
    id: "system:codeReview",
    name: "codeReview",
    description: "代码审查",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "待审查的代码",
        },
        language: {
          type: "string",
          description: "编程语言",
        },
      },
      required: ["code", "language"],
    },
    source: "system",
    isAvailable: true,
  },
];

/**
 * 获取所有可用工具
 * GET /api/tools
 */
export async function GET(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const client = await getClient();

  try {
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
        source: "mcp",
        server: {
          id: String(row.server_id),
          name: String(row.server_name),
        },
        isAvailable: isToolAvailable,
      };
    });

    // 合并系统工具和MCP工具
    const allTools: Tool[] = [...SYSTEM_TOOLS, ...mcpTools];

    // 按名称排序
    allTools.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      tools: allTools,
      // 统计信息
      stats: {
        total: allTools.length,
        system: SYSTEM_TOOLS.length,
        mcp: mcpTools.length,
        available: allTools.filter((t) => t.isAvailable).length,
      },
    });
  } catch (error) {
    console.error("获取工具列表失败:", error);
    return NextResponse.json(
      { error: "获取工具列表失败" },
      { status: 500 }
    );
  }
}
