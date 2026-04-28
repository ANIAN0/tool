/**
 * 文件工具函数库
 * 提供文件大小格式化、类型判断等通用能力
 */

/**
 * 格式化文件大小为可读字符串
 * @param bytes - 字节数
 * @returns 格式化后的字符串，如 "1.5 KB", "2.3 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "-";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${size} ${units[i]}`;
}

/**
 * 根据文件名判断文件类型分类
 * @param name - 文件名（含扩展名）
 * @returns 类型分类标识：code | text | config | image | archive | unknown
 */
export function getFileTypeCategory(name: string): string {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop() || "" : "";

  // 代码文件
  const codeExts = [
    "js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "hpp",
    "cs", "go", "rs", "rb", "php", "swift", "kt", "scala", "r", "m",
    "sql", "sh", "bash", "zsh", "ps1", "cmd", "bat",
  ];
  if (codeExts.includes(ext)) return "code";

  // 文本 / 文档文件
  const textExts = [
    "md", "txt", "log", "rst", "doc", "docx", "pdf", "odt",
    "html", "htm", "xml", "csv", "tsv",
  ];
  if (textExts.includes(ext)) return "text";

  // 配置文件
  const configExts = [
    "json", "yaml", "yml", "toml", "ini", "conf", "config",
    "env", "properties", "gradle", "cmake", "makefile",
  ];
  if (configExts.includes(ext)) return "config";

  // 图片文件
  const imageExts = [
    "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif",
  ];
  if (imageExts.includes(ext)) return "image";

  // 压缩文件
  const archiveExts = [
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz", "tbz",
  ];
  if (archiveExts.includes(ext)) return "archive";

  return "unknown";
}

/**
 * 判断文件是否支持预览
 * 目前支持文本、代码、配置、图片类文件
 * @param name - 文件名
 * @returns 是否可预览
 */
export function isPreviewable(name: string): boolean {
  const category = getFileTypeCategory(name);
  return ["text", "code", "config", "image"].includes(category);
}
