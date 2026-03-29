/**
 * 文件管理主组件
 * 左侧文件树，右侧详情面板
 * 支持目录导航、文件查看、下载、删除
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { FileTree } from "./file-tree";
import { FileDetail } from "./file-detail";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

// 文件条目类型定义（解析 ls -la 输出）
export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  permissions: string;
  modifiedTime: string;
  path: string;
}

// 文件管理组件属性
interface FileManagerProps {
  userId: string;
  sessionId: string;
}

/**
 * 解析 ls -la 输出为文件条目数组
 * 格式：权限 链接数 用户 组 大小 月 日 时间/年份 名称
 * 注意：文件名可能包含空格，使用正则精确捕获
 * @param lsOutput ls -la 命令的输出文本
 * @param currentPath 当前目录路径
 */
function parseLsOutput(lsOutput: string, currentPath: string): FileEntry[] {
  const lines = lsOutput.split("\n").filter((line) => line.trim());
  const entries: FileEntry[] = [];

  // 遍历每一行
  for (const line of lines) {
    // 跳过 total 行（第一行通常是 total 信息）
    if (line.startsWith("total ")) continue;

    // 使用正则分割，精确匹配权限并保留文件名中的空格
    // ls -la 格式示例：drwxr-xr-x 2 user group 4096 Mar 29 10:00 folder name
    // 正则说明：[drwx-]{10} 精确匹配10位权限，(.+)$ 保留文件名中的空格
    const parts = line.match(/^([drwx-]{10})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\d+\s+\S+)\s+(.+)$/);

    if (!parts) continue;

    const permissions = parts[1];  // 权限字符串（10位）
    const size = parseInt(parts[2], 10);  // 文件大小
    const modifiedTime = parts[3];  // 修改时间
    const name = parts[4].trim();  // 文件名（可能包含空格）

    // 跳过 . 和 .. 目录
    if (name === "." || name === "..") continue;

    // 判断类型：权限字符串以 d 开头表示目录
    const type = permissions.startsWith("d") ? "directory" : "file";

    // 构建完整路径
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
 * 文件管理组件
 */
export function FileManager({ userId, sessionId }: FileManagerProps) {
  // 当前目录路径
  const [currentPath, setCurrentPath] = useState("/");
  // 文件列表
  const [files, setFiles] = useState<FileEntry[]>([]);
  // 选中的文件
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  // 加载状态
  const [loading, setLoading] = useState(true);
  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 刷新计数器（用于强制刷新）
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * 加载目录内容
   */
  const loadDirectory = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedFile(null); // 切换目录时清除选中文件

      // 构建请求 URL
      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}&action=list`;

      // 发送认证请求
      const response = await authenticatedFetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "获取文件列表失败");
      }

      const data = await response.json();

      // 解析 ls -la 输出
      if (data.success && data.data?.content) {
        const parsedFiles = parseLsOutput(data.data.content, path);
        setFiles(parsedFiles);
      } else {
        // 空目录或无法解析
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

  /**
   * 初始加载和路径变化时重新加载
   */
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory, refreshKey]);

  /**
   * 进入目录
   */
  const handleNavigate = (entry: FileEntry) => {
    if (entry.type === "directory") {
      setCurrentPath(entry.path);
    } else {
      // 选中文件
      setSelectedFile(entry);
    }
  };

  /**
   * 返回上级目录
   */
  const handleGoBack = () => {
    if (currentPath === "/") return;

    // 计算上级目录路径
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
   * 删除文件后的回调
   */
  const handleDeleteSuccess = () => {
    setSelectedFile(null);
    handleRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左侧文件树 */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              文件列表
            </CardTitle>
            <div className="flex gap-1">
              {/* 返回上级按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                disabled={currentPath === "/" || loading}
                title="返回上级目录"
              >
                ↑
              </Button>
              {/* 刷新按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                title="刷新"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          {/* 当前路径显示 */}
          <div className="text-sm text-muted-foreground mt-1">
            当前路径: <code className="text-blue-600">{currentPath}</code>
          </div>
        </CardHeader>
        <CardContent>
          {/* 加载状态 */}
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 错误提示 */}
          {error && !loading && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button
                  variant="link"
                  size="sm"
                  className="ml-2"
                  onClick={handleRefresh}
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 文件树 */}
          {!loading && !error && (
            <FileTree
              files={files}
              currentPath={currentPath}
              selectedFile={selectedFile}
              onSelect={handleNavigate}
            />
          )}
        </CardContent>
      </Card>

      {/* 右侧文件详情 */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">
            文件详情
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedFile ? (
            <FileDetail
              file={selectedFile}
              sessionId={sessionId}
              onDeleteSuccess={handleDeleteSuccess}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              请从左侧选择一个文件查看详情
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}