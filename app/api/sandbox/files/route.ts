/**
 * 沙盒文件管理 API
 * 提供文件列表、读取、写入、删除功能
 */

import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/infra/user/middleware";
import { getSandboxManager, isSandboxEnabled, validateSandboxPath } from "@/lib/infra/sandbox";

/**
 * 统一错误响应格式
 */
function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

/**
 * 获取文件列表或下载文件
 * GET /api/sandbox/files?sessionId=xxx&path=xxx&action=list|download
 */
export async function GET(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);

  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  // 检查沙盒是否启用
  if (!isSandboxEnabled()) {
    return errorResponse("SERVICE_UNAVAILABLE", "沙盒服务未启用", 503);
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    // 用户请求的路径（相对于 workspace 根目录）
    const userPath = searchParams.get("path") || "/";
    // 获取操作类型：list（列表）或 download（下载）
    const action = searchParams.get("action") || "list";

    if (!sessionId) {
      return errorResponse("VALIDATION_ERROR", "sessionId 不能为空", 400);
    }

    // 添加路径安全验证，防止命令注入和路径遍历攻击
    const pathValidation = validateSandboxPath(userPath);
    if (!pathValidation.valid) {
      return errorResponse("VALIDATION_ERROR", pathValidation.error || "路径无效", 400);
    }

    // 将用户路径映射到沙盒内路径
    // 沙盒内 workspace 挂载为 /workspace，工作目录已经是 /workspace
    // 用户请求 "/" 时，列出当前工作目录（使用 "." 相对路径）
    // 用户请求 "/skills" 时，列出 skills 子目录
    const sandboxPath = userPath === "/"
      ? "/workspace"
      : `/workspace${userPath.startsWith("/") ? userPath : "/" + userPath}`;

    // 将用户路径转换为相对路径（去除前导 /），用于 readFile/writeFile 接口
    // Gateway 的 validate_path 会拒绝绝对路径，所以必须传相对路径
    const relativePath = userPath === "/" ? "" : userPath.startsWith("/") ? userPath.slice(1) : userPath;

    const sandbox = getSandboxManager();

    // 下载文件操作
    if (action === "download") {
      // 检查路径是否为空
      if (!userPath || userPath === "/") {
        return errorResponse("VALIDATION_ERROR", "下载时必须指定文件路径", 400);
      }

      try {
        // 使用 sandbox.readFile 获取文件内容（传入相对路径）
        console.log(`[文件下载] sessionId=${sessionId}, relativePath=${relativePath}`);
        const content = await sandbox.readFile({
          sessionId,
          userId,
          relativePath: relativePath,
        });

        // 从路径中提取文件名
        const filename = userPath.split("/").pop() || "file";

        // 返回文件内容，设置下载响应头
        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      } catch (readError) {
        // 处理文件不存在或其他读取错误，传递 Gateway 返回的具体错误信息
        console.error("[文件下载失败]", {
          sessionId,
          relativePath,
          error: readError instanceof Error ? readError.message : readError,
        });
        // 使用 Gateway 返回的错误信息，而不是固定的错误消息
        const errorMessage = readError instanceof Error ? readError.message : "文件不存在或无法读取";
        return errorResponse("NOT_FOUND", errorMessage, 404);
      }
    }

    // 默认操作：列出目录内容
    // 使用相对路径 "." 避免绝对路径问题，沙盒内工作目录已经是 /workspace
    const lsPath = sandboxPath === "/workspace" ? "." : sandboxPath.replace("/workspace/", "");

    const result = await sandbox.exec({
      sessionId,
      userId,
      // 不使用 2>/dev/null，因为沙盒内 /dev/null 可能是只读的
      code: `ls -la "${lsPath}" && echo "LS_SUCCESS" || echo "NOT_FOUND"`,
      language: "bash",
    });

    // 检查是否 ls 成功
    if (result.stdout.includes("LS_SUCCESS")) {
      // 移除 LS_SUCCESS 标记，返回干净的内容
      const content = result.stdout.replace(/\n?LS_SUCCESS\n?$/, "");
      return NextResponse.json({
        success: true,
        data: {
          // 返回用户原始路径（前端显示）
          path: userPath,
          content: content,
        },
      });
    }

    // ls 失败
    return errorResponse("NOT_FOUND", "路径不存在", 404);
  } catch (error) {
    console.error("获取文件列表失败:", error);
    return errorResponse("INTERNAL_ERROR", "获取文件列表失败", 500);
  }
}

/**
 * 写入文件
 * POST /api/sandbox/files
 */
export async function POST(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  // 检查沙盒是否启用
  if (!isSandboxEnabled()) {
    return errorResponse("SERVICE_UNAVAILABLE", "沙盒服务未启用", 503);
  }

  try {
    const body = await request.json();
    const { sessionId, path, content } = body;

    if (!sessionId || !path || content === undefined) {
      return errorResponse("VALIDATION_ERROR", "参数不完整", 400);
    }

    // 添加路径安全验证，防止命令注入和路径遍历攻击
    const pathValidation = validateSandboxPath(path);
    if (!pathValidation.valid) {
      return errorResponse("VALIDATION_ERROR", pathValidation.error || "路径无效", 400);
    }

    // 将用户路径转换为相对路径（去除前导 /）
    // Gateway 的 validate_path 会拒绝绝对路径，所以必须传相对路径
    const relativePath = path.startsWith("/") ? path.slice(1) : path;

    const sandbox = getSandboxManager();

    // 写入文件（传入相对路径）
    await sandbox.writeFile({
      sessionId,
      userId,
      relativePath: relativePath,
      content,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("写入文件失败:", error);
    return errorResponse("INTERNAL_ERROR", "写入文件失败", 500);
  }
}

/**
 * 删除文件
 * DELETE /api/sandbox/files?sessionId=xxx&path=xxx
 */
export async function DELETE(request: NextRequest) {
  // 验证用户身份
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return errorResponse("UNAUTHORIZED", authResult.error, authResult.status);
  }

  const userId = authResult.userId;

  // 检查沙盒是否启用
  if (!isSandboxEnabled()) {
    return errorResponse("SERVICE_UNAVAILABLE", "沙盒服务未启用", 503);
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    // 用户请求的路径
    const userPath = searchParams.get("path");

    if (!sessionId || !userPath) {
      return errorResponse("VALIDATION_ERROR", "参数不完整", 400);
    }

    // 添加路径安全验证，防止命令注入和路径遍历攻击
    const pathValidation = validateSandboxPath(userPath);
    if (!pathValidation.valid) {
      return errorResponse("VALIDATION_ERROR", pathValidation.error || "路径无效", 400);
    }

    // 将用户路径映射到沙盒内路径
    const sandboxPath = userPath === "/"
      ? "/workspace"
      : `/workspace${userPath.startsWith("/") ? userPath : "/" + userPath}`;

    const sandbox = getSandboxManager();

    // 删除文件（使用沙盒内路径）
    await sandbox.exec({
      sessionId,
      userId,
      code: `rm -rf "${sandboxPath}"`,
      language: "bash",
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("删除文件失败:", error);
    return errorResponse("INTERNAL_ERROR", "删除文件失败", 500);
  }
}