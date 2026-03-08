/**
 * 单个文档API路由
 * 提供单个文档的获取、更新和删除操作
 */

import { NextResponse } from "next/server";
import { getDocumentById, updateDocument, deleteDocument } from "@/lib/db";

/**
 * GET /api/documents/:id
 * 获取单个文档详情
 */
export async function GET(
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

    // 获取文档
    const document = await getDocumentById(id);

    if (!document) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    // 验证权限
    if (document.user_id !== userId) {
      return NextResponse.json({ error: "无权访问此文档" }, { status: 403 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("获取文档失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * PATCH /api/documents/:id
 * 更新文档（标题或内容）
 *
 * 请求体:
 * { title?: string, content?: string }
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

    // 检查文档是否存在
    const existingDocument = await getDocumentById(id);
    if (!existingDocument) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    // 验证权限
    if (existingDocument.user_id !== userId) {
      return NextResponse.json({ error: "无权访问此文档" }, { status: 403 });
    }

    // 解析请求体
    const body = await request.json();
    const { title, content } = body;

    // 构建更新对象
    const updates: { title?: string; content?: string } = {};
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim() === "") {
        return NextResponse.json({ error: "文档标题不能为空" }, { status: 400 });
      }
      updates.title = title.trim();
    }
    if (content !== undefined) {
      updates.content = content;
    }

    // 更新文档
    const success = await updateDocument(id, updates);

    if (!success) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    // 获取更新后的文档
    const updatedDocument = await getDocumentById(id);

    return NextResponse.json({ document: updatedDocument });
  } catch (error) {
    console.error("更新文档失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/:id
 * 删除文档
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

    // 检查文档是否存在
    const existingDocument = await getDocumentById(id);
    if (!existingDocument) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    // 验证权限
    if (existingDocument.user_id !== userId) {
      return NextResponse.json({ error: "无权访问此文档" }, { status: 403 });
    }

    // 删除文档
    const success = await deleteDocument(id);

    if (!success) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除文档失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
