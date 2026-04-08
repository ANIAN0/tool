/**
 * 文件表格组件
 * 表格布局展示文件列表
 * 支持目录导航、文件查看、下载、删除
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  FileText,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  ChevronRight,
  Home,
  Folder,
  File,
  FileCode,
  Image,
  Settings,
  Archive,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";
import { formatFileSize, getFileTypeCategory } from "@/lib/utils/file-utils";

// 文件条目类型定义（解析 ls -la 输出）
export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  permissions: string;
  modifiedTime: string;
  path: string;
}

// FileTable 组件属性
interface FileTableProps {
  sessionId: string;
  onViewFile: (file: FileEntry) => void; // 查看文件详情回调
}

/**
 * 解析 ls -la 输出为文件条目数组
 * 格式：权限 链接数 用户 组 大小 月 日 时间/年份 名称
 */
function parseLsOutput(lsOutput: string, currentPath: string): FileEntry[] {
  const lines = lsOutput.split("\n").filter((line) => line.trim());
  const entries: FileEntry[] = [];

  for (const line of lines) {
    if (line.startsWith("total ")) continue;

    const parts = line.match(/^([drwx-]{10})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\d+\s+\S+)\s+(.+)$/);

    if (!parts) continue;

    const permissions = parts[1];
    const size = parseInt(parts[2], 10);
    const modifiedTime = parts[3];
    const name = parts[4].trim();

    if (name === "." || name === "..") continue;

    const type = permissions.startsWith("d") ? "directory" : "file";
    const fullPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;

    entries.push({
      name,
      type,
      size,
      permissions,
      modifiedTime,
      path: fullPath,
    });
  }

  // 按类型排序：目录优先，然后按名称排序
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

/**
 * 根据文件名判断文件图标类型
 */
function getFileIcon(name: string, type: "file" | "directory") {
  if (type === "directory") {
    return <Folder className="size-4 text-blue-500" />;
  }

  const category = getFileTypeCategory(name);

  switch (category) {
    case "code":
      return <FileCode className="size-4 text-green-500" />;
    case "text":
      return <FileText className="size-4 text-orange-500" />;
    case "config":
      return <Settings className="size-4 text-blue-500" />;
    case "image":
      return <Image className="size-4 text-purple-500" />;
    case "archive":
      return <Archive className="size-4 text-yellow-500" />;
    default:
      return <File className="size-4 text-gray-500" />;
  }
}

/**
 * 格式化修改时间显示
 */
function formatModifiedTime(timeStr: string): string {
  // ls -la 输出的时间格式：Mar 29 10:00 或 Mar 29 2024
  return timeStr;
}

/**
 * 文件表格组件
 */
export function FileTable({ sessionId, onViewFile }: FileTableProps) {
  // 当前目录路径
  const [currentPath, setCurrentPath] = useState("/");
  // 文件列表
  const [files, setFiles] = useState<FileEntry[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(true);
  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 刷新计数器
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * 加载目录内容
   */
  const loadDirectory = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);

      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}&action=list`;
      const response = await authenticatedFetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "获取文件列表失败");
      }

      const data = await response.json();

      if (data.success && data.data?.content) {
        const parsedFiles = parseLsOutput(data.data.content, path);
        setFiles(parsedFiles);
      } else {
        setFiles([]);
      }
    } catch (err) {
      console.error("加载目录失败:", err);
      setError(err instanceof Error ? err.message : "加载失败");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // 初始加载和路径变化时重新加载
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory, refreshKey]);

  /**
   * 进入下级目录
   */
  const handleNavigateDown = (entry: FileEntry) => {
    if (entry.type === "directory") {
      setCurrentPath(entry.path);
    } else {
      // 文件：打开详情抽屉
      onViewFile(entry);
    }
  };

  /**
   * 跳转到指定路径（面包屑点击）
   */
  const handleNavigateTo = (path: string) => {
    setCurrentPath(path);
  };

  /**
   * 返回上级目录
   */
  const handleGoBack = () => {
    if (currentPath === "/") return;

    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const parentPath = parts.length === 0 ? "/" : "/" + parts.join("/");
    setCurrentPath(parentPath);
  };

  /**
   * 刷新当前目录
   */
  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  /**
   * 下载文件
   */
  const handleDownload = async (file: FileEntry) => {
    try {
      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}&action=download`;
      const response = await authenticatedFetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "下载文件失败");
      }

      const content = await response.text();
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("下载文件失败:", err);
      alert(err instanceof Error ? err.message : "下载失败");
    }
  };

  /**
   * 删除文件
   */
  const handleDelete = async (file: FileEntry) => {
    if (!confirm(`确定要删除 ${file.name} 吗？${file.type === "directory" ? "\n注意：删除目录将删除目录下的所有文件和子目录。" : ""}`)) {
      return;
    }

    try {
      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}`;
      const response = await authenticatedFetch(url, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "删除文件失败");
      }

      // 删除成功后刷新列表
      handleRefresh();
    } catch (err) {
      console.error("删除文件失败:", err);
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  /**
   * 解析路径为面包屑数组
   */
  const parsePathBreadcrumb = (path: string): Array<{ name: string; path: string }> => {
    if (path === "/") {
      return [{ name: "根目录", path: "/" }];
    }

    const parts = path.split("/").filter(Boolean);
    const breadcrumb = [{ name: "根目录", path: "/" }];

    parts.forEach((part, index) => {
      breadcrumb.push({
        name: part,
        path: "/" + parts.slice(0, index + 1).join("/"),
      });
    });

    return breadcrumb;
  };

  const breadcrumb = parsePathBreadcrumb(currentPath);

  return (
    <div className="flex flex-col gap-4">
      {/* 工具栏：面包屑导航 + 刷新按钮 */}
      <div className="flex items-center justify-between">
        {/* 面包屑路径导航 */}
        <div className="flex items-center gap-1 text-sm">
          {breadcrumb.map((item, index) => (
            <div key={item.path} className="flex items-center gap-1">
              {index === 0 ? (
                <Home className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
              <button
                onClick={() => handleNavigateTo(item.path)}
                className={`hover:text-foreground transition-colors ${
                  index === breadcrumb.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
                disabled={loading}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>

        {/* 刷新按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          title="刷新"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* 表格区域 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-[80px]">类型</TableHead>
              <TableHead className="w-[100px]">大小</TableHead>
              <TableHead className="w-[150px]">修改时间</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 加载状态：骨架屏 */}
            {loading &&
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}

            {/* 错误状态 */}
            {!loading && error && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                      <RefreshCw className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">{error}</p>
                    <Button variant="outline" onClick={handleRefresh}>
                      重试
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 空状态 */}
            {!loading && !error && files.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <FolderOpen className="size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {currentPath === "/" ? "沙盒工作区暂无文件" : "当前目录为空"}
                    </p>
                    {currentPath !== "/" && (
                      <Button variant="outline" onClick={handleGoBack}>
                        返回上级目录
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 数据行 */}
            {!loading && !error && files.length > 0 && files.map((file) => (
              <TableRow
                key={file.path}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleNavigateDown(file)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.name, file.type)}
                    <span className="truncate">{file.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={file.type === "directory" ? "default" : "secondary"}>
                    {file.type === "directory" ? "目录" : "文件"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {file.type === "file" ? formatFileSize(file.size) : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatModifiedTime(file.modifiedTime)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {file.type === "file" && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onViewFile(file);
                        }}>
                          <Eye className="size-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                      )}
                      {file.type === "file" && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}>
                          <Download className="size-4 mr-2" />
                          下载
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}