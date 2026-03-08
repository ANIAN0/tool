/**
 * 文档API路由
 * 提供文档的CRUD操作
 */

import { NextResponse } from "next/server";
import {
  getDocumentsByUserId,
  getDocumentsByFolderId,
  createDocument,
} from "@/lib/db";
import { nanoid } from "nanoid";

/**
 * GET /api/documents
 * 获取用户的文档列表
 *
 * 查询参数:
 * - folderId: 指定文件夹ID，不传则返回所有文档
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
    const folderId = searchParams.get("folderId");

    let documents;
    if (folderId === null) {
      // 返回所有文档（按用户ID过滤）
      documents = await getDocumentsByUserId(userId);
    } else if (folderId === "") {
      // 返回根目录文档（按用户ID过滤）
      documents = (await getDocumentsByFolderId(null)).filter(
        (doc) => doc.user_id === userId
      );
    } else {
      // 返回指定文件夹的文档（按用户ID过滤）
      documents = (await getDocumentsByFolderId(folderId)).filter(
        (doc) => doc.user_id === userId
      );
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("获取文档列表失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST /api/documents
 * 创建新文档
 *
 * 请求体:
 * { title: string, folderId?: string | null, content?: string }
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
    const { title, folderId, content } = body;

    // 验证必填字段
    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json({ error: "文档标题不能为空" }, { status: 400 });
    }

    // 创建文档
    const document = await createDocument({
      id: nanoid(),
      title: title.trim(),
      folderId: folderId || null,
      userId,
      content,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("创建文档失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
