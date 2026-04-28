/**
 * Supabase Storage 操作封装
 * 提供 Skill 文件的上传、下载、删除等功能
 */

import { getSupabaseServerClient, SKILLS_BUCKET, isSupabaseConfigured } from "./client";

/**
 * Skill 文件上传结果
 */
export interface SkillUploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Skill 文件下载结果
 */
export interface SkillDownloadResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Skill 目录下载结果（包含多个文件）
 */
export interface SkillDirectoryDownloadResult {
  success: boolean;
  files?: Array<{ path: string; content: string }>;
  error?: string;
}

/**
 * Skill 目录上传结果
 */
export interface SkillDirectoryUploadResult {
  success: boolean;
  uploadedCount?: number;
  paths?: string[];
  error?: string;
}

/**
 * 生成 Skill 在 Storage 中的路径
 * @param userId 用户 ID
 * @param skillId Skill ID
 * @param fileName 文件名（默认 skill.md）
 */
export function getSkillStoragePath(userId: string, skillId: string, fileName: string = "skill.md"): string {
  return `skills/${userId}/${skillId}/${fileName}`;
}

/**
 * 上传 Skill 文件到 Storage
 * @param userId 用户 ID
 * @param skillId Skill ID
 * @param content 文件内容
 * @param fileName 文件名（默认 skill.md）
 */
export async function uploadSkillFile(
  userId: string,
  skillId: string,
  content: string,
  fileName: string = "skill.md"
): Promise<SkillUploadResult> {
  // 检查 Supabase 是否配置
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase 未配置",
    };
  }

  try {
    const supabase = getSupabaseServerClient();
    const path = getSkillStoragePath(userId, skillId, fileName);

    // 上传文件
    const { error } = await supabase.storage
      .from(SKILLS_BUCKET)
      .upload(path, content, {
        contentType: "text/markdown",
        upsert: true, // 覆盖已存在的文件
      });

    if (error) {
      console.error("上传 Skill 文件失败:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      path,
    };
  } catch (error) {
    console.error("上传 Skill 文件异常:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * 从 Storage 下载 Skill 文件
 * @param path 文件路径
 */
export async function downloadSkillFile(path: string): Promise<SkillDownloadResult> {
  // 检查 Supabase 是否配置
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase 未配置",
    };
  }

  try {
    const supabase = getSupabaseServerClient();

    // 下载文件
    const { data, error } = await supabase.storage
      .from(SKILLS_BUCKET)
      .download(path);

    if (error) {
      console.error("下载 Skill 文件失败:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    // 将 Blob 转换为字符串
    const content = await data.text();

    return {
      success: true,
      content,
    };
  } catch (error) {
    console.error("下载 Skill 文件异常:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "下载失败",
    };
  }
}

/**
 * 删除 Skill 目录（包括所有文件）
 * @param userId 用户 ID
 * @param skillId Skill ID
 */
export async function deleteSkillDirectory(
  userId: string,
  skillId: string
): Promise<{ success: boolean; error?: string }> {
  // 检查 Supabase 是否配置
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase 未配置",
    };
  }

  try {
    const supabase = getSupabaseServerClient();
    const prefix = `skills/${userId}/${skillId}/`;

    // 列出目录下所有文件
    const { data: files, error: listError } = await supabase.storage
      .from(SKILLS_BUCKET)
      .list(`skills/${userId}/${skillId}`);

    if (listError) {
      console.error("列出 Skill 文件失败:", listError);
      return {
        success: false,
        error: listError.message,
      };
    }

    // 如果目录为空，直接返回成功
    if (!files || files.length === 0) {
      return { success: true };
    }

    // 构建完整路径列表
    const pathsToDelete = files.map((file) => `${prefix}${file.name}`);

    // 批量删除文件
    const { error: deleteError } = await supabase.storage
      .from(SKILLS_BUCKET)
      .remove(pathsToDelete);

    if (deleteError) {
      console.error("删除 Skill 文件失败:", deleteError);
      return {
        success: false,
        error: deleteError.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("删除 Skill 目录异常:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 计算文件的 SHA256 哈希
 * @param content 文件内容
 */
export async function calculateFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 根据文件扩展名获取 Content-Type
 * @param path 文件路径
 * @returns 对应的 Content-Type
 */
function getContentType(path: string): string {
  // 获取文件扩展名
  const ext = path.split(".").pop()?.toLowerCase() || "";

  // 常见文件类型的 Content-Type 映射
  const contentTypeMap: Record<string, string> = {
    // Markdown 文件
    md: "text/markdown",
    // 文本文件
    txt: "text/plain",
    // JSON 文件
    json: "application/json",
    // JavaScript 文件
    js: "application/javascript",
    mjs: "application/javascript",
    // TypeScript 文件
    ts: "application/typescript",
    tsx: "application/typescript",
    // YAML 文件
    yaml: "application/yaml",
    yml: "application/yaml",
    // HTML 文件
    html: "text/html",
    htm: "text/html",
    // CSS 文件
    css: "text/css",
    // XML 文件
    xml: "application/xml",
    // Python 文件
    py: "text/x-python",
    // 图片文件
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    // 其他默认为二进制流
  };

  // 返回对应的 Content-Type，默认使用二进制流
  return contentTypeMap[ext] || "application/octet-stream";
}

/**
 * 列出目录下所有文件（递归）
 * @param supabase Supabase 客户端
 * @param prefix 目录路径前缀
 * @returns 文件完整路径列表
 */
async function listAllFiles(supabase: any, prefix: string): Promise<string[]> {
  const allFiles: string[] = [];

  // 递归列出文件的辅助函数
  async function listRecursive(currentPath: string): Promise<void> {
    // 列出当前目录下的文件和子目录
    const { data, error } = await supabase.storage
      .from(SKILLS_BUCKET)
      .list(currentPath);

    if (error) {
      console.error(`列出目录 ${currentPath} 失败:`, error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    // 遍历每个项目
    for (const item of data) {
      // 构建完整路径
      const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;

      // 如果是目录（没有扩展名且 metadata 显示为文件夹），递归处理
      // Supabase Storage 中，文件夹通常 name 不带扩展名
      if (!item.name.includes(".") && item.metadata === null) {
        // 递归进入子目录
        await listRecursive(fullPath);
      } else {
        // 是文件，添加到列表
        allFiles.push(fullPath);
      }
    }
  }

  // 从指定前缀开始递归
  await listRecursive(prefix);

  return allFiles;
}

/**
 * 上传 Skill 目录到 Storage
 * @param userId 用户 ID
 * @param skillName Skill 名称（作为目录名）
 * @param files 文件列表（含相对路径和内容）
 */
export async function uploadSkillDirectory(
  userId: string,
  skillName: string,
  files: Array<{ path: string; content: string }>
): Promise<SkillDirectoryUploadResult> {
  // 检查 Supabase 是否配置
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase 未配置",
    };
  }

  // 验证参数
  if (!userId || !skillName || !files || files.length === 0) {
    return {
      success: false,
      error: "参数不完整",
    };
  }

  try {
    const supabase = getSupabaseServerClient();
    const uploadedPaths: string[] = [];

    // 遍历所有文件并上传
    for (const file of files) {
      // 构建 Storage 中的完整路径：skills/{userId}/{skillName}/{relativePath}
      const storagePath = `skills/${userId}/${skillName}/${file.path}`;

      // 获取对应的 Content-Type
      const contentType = getContentType(file.path);

      // 上传文件，使用 upsert 覆盖已存在的文件
      const { error } = await supabase.storage
        .from(SKILLS_BUCKET)
        .upload(storagePath, file.content, {
          contentType,
          upsert: true, // 覆盖已存在的文件
        });

      if (error) {
        console.error(`上传文件 ${file.path} 失败:`, error);
        // 继续上传其他文件，不中断整个流程
        continue;
      }

      uploadedPaths.push(storagePath);
    }

    // 检查上传结果
    if (uploadedPaths.length === 0) {
      return {
        success: false,
        error: "所有文件上传失败",
      };
    }

    return {
      success: true,
      uploadedCount: uploadedPaths.length,
      paths: uploadedPaths,
    };
  } catch (error) {
    console.error("上传 Skill 目录异常:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * 从 Storage 下载 Skill 目录下所有文件
 * @param userId 用户 ID
 * @param skillName Skill 名称（作为目录名）
 */
export async function downloadSkillDirectory(
  userId: string,
  skillName: string
): Promise<SkillDirectoryDownloadResult> {
  // 检查 Supabase 是否配置
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase 未配置",
    };
  }

  try {
    const supabase = getSupabaseServerClient();
    const directoryPath = `skills/${userId}/${skillName}`;

    // 递归列出目录下所有文件
    const filePaths = await listAllFiles(supabase, directoryPath);

    if (filePaths.length === 0) {
      return {
        success: false,
        error: "目录为空或不存在",
      };
    }

    // 下载所有文件
    const downloadedFiles: Array<{ path: string; content: string }> = [];

    for (const fullPath of filePaths) {
      // 下载文件
      const { data, error } = await supabase.storage
        .from(SKILLS_BUCKET)
        .download(fullPath);

      if (error) {
        console.error(`下载文件 ${fullPath} 失败:`, error);
        // 继续下载其他文件
        continue;
      }

      // 将 Blob 转换为字符串
      const content = await data.text();

      // 计算相对路径（去掉 skills/{userId}/{skillName}/ 前缀）
      const prefixToRemove = `${directoryPath}/`;
      const relativePath = fullPath.startsWith(prefixToRemove)
        ? fullPath.slice(prefixToRemove.length)
        : fullPath;

      downloadedFiles.push({
        path: relativePath,
        content,
      });
    }

    if (downloadedFiles.length === 0) {
      return {
        success: false,
        error: "所有文件下载失败",
      };
    }

    return {
      success: true,
      files: downloadedFiles,
    };
  } catch (error) {
    console.error("下载 Skill 目录异常:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "下载失败",
    };
  }
}

/**
 * 计算目录的整体哈希
 * @param files 文件列表（已按路径排序）
 * @returns 目录整体的 SHA256 哈希
 */
export async function calculateDirectoryHash(
  files: Array<{ path: string; content: string }>
): Promise<string> {
  // 按路径排序文件，确保哈希稳定
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // 计算每个文件的哈希
  const fileHashes: string[] = [];
  for (const file of sortedFiles) {
    const hash = await calculateFileHash(file.content);
    fileHashes.push(`${file.path}:${hash}`);
  }

  // 将所有文件哈希拼接，计算整体哈希
  const combinedContent = fileHashes.join("\n");
  return calculateFileHash(combinedContent);
}