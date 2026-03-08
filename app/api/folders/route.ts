/**
 * 文件夹API路由
 * 提供文件夹的CRUD操作
 */

import { NextResponse } from "next/server";
import {
  getFoldersByUserId,
  createFolder,
  getFolderTree,
} from "@/lib/db";
import { nanoid } from "nanoid";

/**
 * GET /api/folders
 * 获取用户的文件夹列表或树形结构
 *
 * 查询参数:
 * - tree: 如果为"true"，返回树形结构
 */
export async function GET(request: Request) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return NextResponse.json({ error: "用户ID不能为空" }, { status: 401 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const tree = searchParams.get("tree") === "true";

    if (tree) {
      // 获取树形结构
      const folderTree = await getFolderTree(userId);
      return NextResponse.json({ folders: folderTree });
    } else {
      // 获取扁平列表
      const folders = await getFoldersByUserId(userId);
      return NextResponse.json({ folders });
    }
  } catch (error) {
    console.error("获取文件夹列表失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST /api/folders
 * 创建新文件夹
 *
 * 请求体:
 * { name: string, parentId?: string | null }
 */
export async function POST(request: Request) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return NextResponse.json({ error: "用户ID不能为空" }, { status: 401 });
    }

    // 解析请求体
    const body = await request.json();
    const { name, parentId } = body;

    // 验证必填字段
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "文件夹名称不能为空" }, { status: 400 });
    }

    // 创建文件夹
    const folder = await createFolder({
      id: nanoid(),
      name: name.trim(),
      parentId: parentId || null,
      userId,
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("创建文件夹失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
