/**
 * 图片上传API路由
 * 处理编辑器中的图片上传请求
 */

import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";

// 允许的图片格式
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// 最大文件大小 (5MB)
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/upload
 * 上传图片文件
 *
 * 请求体: FormData with 'image' field
 * 响应: { url: string }
 */
export async function POST(request: Request) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return NextResponse.json({ error: "用户ID不能为空" }, { status: 401 });
    }

    // 解析FormData
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未找到图片文件" }, { status: 400 });
    }

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "不支持的图片格式，仅支持 JPG、PNG、GIF、WebP" },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "图片大小超过5MB限制" },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const extension = file.name.split(".").pop() || "png";
    const fileName = `${nanoid()}.${extension}`;

    // 按日期组织上传目录
    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const uploadDir = join(process.cwd(), "public", "uploads", datePath);

    // 确保目录存在
    await mkdir(uploadDir, { recursive: true });

    // 保存文件
    const filePath = join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // 生成访问URL
    const url = `/uploads/${datePath}/${fileName}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("图片上传失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
