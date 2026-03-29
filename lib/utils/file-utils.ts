/**
 * 文件工具函数
 * 提供文件相关的通用处理函数
 */

/**
 * 格式化文件大小
 * 将字节数转换为人类可读的格式
 *
 * @param bytes - 文件大小（字节）
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  // 0 字节特殊处理
  if (bytes === 0) return "0 B";
  // 小于 1KB
  if (bytes < 1024) return `${bytes} B`;
  // 小于 1MB
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  // 小于 1GB
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  // GB级别
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 文件类型枚举
 * 用于判断文件应该使用什么图标
 */
export type FileTypeCategory = "code" | "text" | "config" | "image" | "archive" | "other";

/**
 * 根据文件名获取文件类型分类
 * 用于组件中决定显示什么图标
 *
 * @param filename - 文件名
 * @returns 文件类型分类
 */
export function getFileTypeCategory(filename: string): FileTypeCategory {
  // 获取文件扩展名
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // 代码文件类型
  const codeExtensions = [
    "js", "ts", "jsx", "tsx", "py", "rb", "go", "java", "c", "cpp", "h", "rs"
  ];

  // 文本文件类型
  const textExtensions = [
    "md", "txt", "json", "yaml", "yml", "xml", "csv", "log", "html", "css"
  ];

  // 配置文件类型
  const configExtensions = [
    "env", "gitignore", "dockerignore", "dockerfile", "ini", "conf", "config", "toml"
  ];

  // 图片文件类型
  const imageExtensions = [
    "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"
  ];

  // 压缩文件类型
  const archiveExtensions = [
    "zip", "tar", "gz", "rar", "7z"
  ];

  // 判断类型
  if (codeExtensions.includes(ext)) return "code";
  if (textExtensions.includes(ext)) return "text";
  if (configExtensions.includes(ext)) return "config";
  if (imageExtensions.includes(ext)) return "image";
  if (archiveExtensions.includes(ext)) return "archive";

  return "other";
}

/**
 * 判断文件是否可预览（文本文件）
 *
 * @param filename - 文件名
 * @returns 是否可预览
 */
export function isPreviewable(filename: string): boolean {
  // 获取文件扩展名
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // 可预览的文件类型：文本、代码、配置文件等
  const previewableExtensions = [
    "md", "txt", "json", "yaml", "yml", "xml", "csv", "log",
    "js", "ts", "jsx", "tsx", "py", "rb", "go", "java", "c", "cpp", "h",
    "html", "css", "scss", "sass", "less", "sh", "bash", "zsh",
    "sql", "env", "gitignore", "dockerignore", "dockerfile",
    "properties", "ini", "conf", "config", "toml",
  ];

  return previewableExtensions.includes(ext);
}

/**
 * 获取文件的MIME类型
 *
 * @param filename - 文件名
 * @returns MIME类型字符串
 */
export function getFileMimeType(filename: string): string {
  // 获取文件扩展名
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // MIME类型映射表
  const mimeMap: Record<string, string> = {
    "txt": "text/plain",
    "md": "text/markdown",
    "json": "application/json",
    "yaml": "text/yaml",
    "yml": "text/yaml",
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "ts": "application/typescript",
    "py": "text/x-python",
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
  };

  return mimeMap[ext] || "application/octet-stream";
}