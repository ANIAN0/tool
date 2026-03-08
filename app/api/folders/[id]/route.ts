/**
 * 单个文件夹API路由
 * 提供单个文件夹的更新和删除操作
 */

import { NextResponse } from "next/server";
import { getFolderById, updateFolder, deleteFolder } from "@/lib/db";

/**
 * PATCH /api/folders/:id
 * 更新文件夹（重命名）
 *
 * 请求体:
 * { name: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return NextResponse.json({ error: "用户ID不能为空" }, { status: 401 });
    }

    const { id } = await params;

    // 检查文件夹是否存在
    const existingFolder = await getFolderById(id);
    if (!existingFolder) {
      return NextResponse.json({ error: "文件夹不存在" }, { status: 404 });
    }

    // 验证权限
    if (existingFolder.user_id !== userId) {
      return NextResponse.json({ error: "无权访问此文件夹" }, { status: 403 });
    }

    // 解析请求体
    const body = await request.json();
    const { name } = body;

    // 验证必填字段
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "文件夹名称不能为空" }, { status: 400 });
    }

    // 更新文件夹
    const success = await updateFolder(id, name.trim());

    if (!success) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    // 获取更新后的文件夹
    const updatedFolder = await getFolderById(id);

    return NextResponse.json({ folder: updatedFolder });
  } catch (error) {
    console.error("更新文件夹失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/folders/:id
 * 删除文件夹（会级联删除子文件夹和文档）
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return NextResponse.json({ error: "用户ID不能为空" }, { status: 401 });
    }

    const { id } = await params;

    // 检查文件夹是否存在
    const existingFolder = await getFolderById(id);
    if (!existingFolder) {
      return NextResponse.json({ error: "文件夹不存在" }, { status: 404 });
    }

    // 验证权限
    if (existingFolder.user_id !== userId) {
      return NextResponse.json({ error: "无权访问此文件夹" }, { status: 403 });
    }

    // 删除文件夹
    const success = await deleteFolder(id);

    if (!success) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除文件夹失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
