/**
 * 文件详情抽屉组件
 * 右侧 Sheet 展示文件详细信息
 * 支持文件预览、下载、删除
 */

"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  FileText,
  FileCode,
  Image,
  Settings,
  Archive,
  File,
  Folder,
  Calendar,
  HardDrive,
  Shield,
} from "lucide-react";
import type { FileEntry } from "./file-table";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";
import { formatFileSize, getFileTypeCategory } from "@/lib/utils/file-utils";

// FileSheet 组件属性
interface FileSheetProps {
  file: FileEntry | null; // 当前选中的文件
  sessionId: string; // Session ID（用于 API 请求）
  open: boolean; // 抽屉打开状态
  onClose: () => void; // 关闭回调
  onDeleteSuccess: () => void; // 删除成功回调
}

/**
 * 获取文件图标（根据文件类型返回对应的图标组件）
 */
function getFileIcon(name: string, type: "file" | "directory") {
  if (type === "directory") {
    return <Folder className="size-6 text-blue-500" />;
  }

  const category = getFileTypeCategory(name);

  switch (category) {
    case "code":
      return <FileCode className="size-6 text-green-500" />;
    case "text":
      return <FileText className="size-6 text-orange-500" />;
    case "config":
      return <Settings className="size-6 text-blue-500" />;
    case "image":
      return <Image className="size-6 text-purple-500" />;
    case "archive":
      return <Archive className="size-6 text-yellow-500" />;
    default:
      return <File className="size-6 text-gray-500" />;
  }
}

/**
 * 格式化修改时间显示
 */
function formatDateTime(timeStr: string): string {
  // ls -la 输出的时间格式：Mar 29 10:00 或 Mar 29 2024
  return timeStr;
}

/**
 * 文件详情抽屉组件
 */
export function FileSheet({ file, sessionId, open, onClose, onDeleteSuccess }: FileSheetProps) {
  // 预览内容状态
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  // 预览加载状态
  const [previewLoading, setPreviewLoading] = useState(false);
  // 预览错误信息
  const [previewError, setPreviewError] = useState<string | null>(null);

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // 删除加载状态
  const [deleteLoading, setDeleteLoading] = useState(false);
  // 删除错误信息
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * 预览文件内容
   */
  const handlePreview = async () => {
    if (!file) return;

    try {
      setPreviewLoading(true);
      setPreviewError(null);

      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}&action=download`;
      const response = await authenticatedFetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "获取文件内容失败");
      }

      const content = await response.text();
      setPreviewContent(content);
    } catch (err) {
      console.error("预览文件失败:", err);
      setPreviewError(err instanceof Error ? err.message : "预览失败");
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * 下载文件
   */
  const handleDownload = async () => {
    if (!file) return;

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
  const handleDelete = async () => {
    if (!file) return;

    try {
      setDeleteLoading(true);
      setDeleteError(null);

      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}`;
      const response = await authenticatedFetch(url, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "删除文件失败");
      }

      // 删除成功，关闭对话框和抽屉，触发回调
      setDeleteDialogOpen(false);
      onClose();
      onDeleteSuccess();
    } catch (err) {
      console.error("删除文件失败:", err);
      setDeleteError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  /**
   * 关闭抽屉时重置状态
   */
  const handleClose = () => {
    setPreviewContent(null);
    setPreviewError(null);
    setDeleteError(null);
    onClose();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          {/* 头部区域 */}
          <SheetHeader className="p-6 pb-0">
            <div className="flex items-center gap-3">
              {file && getFileIcon(file.name, file.type)}
              <SheetTitle className="text-xl">
                {file?.name ?? "文件详情"}
              </SheetTitle>
            </div>
            <SheetDescription className="text-base mt-2">
              {file?.path ?? ""}
            </SheetDescription>
          </SheetHeader>

          {/* 内容区域 */}
          <ScrollArea className="flex-1 px-6">
            {!file ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                  <RefreshCw className="size-5 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">加载文件详情...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 py-6">
                {/* 统计卡片 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Calendar className="size-3" />
                      <span>修改时间</span>
                    </div>
                    <div className="text-sm font-medium">{formatDateTime(file.modifiedTime)}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <HardDrive className="size-3" />
                      <span>文件大小</span>
                    </div>
                    <div className="text-sm font-medium">{formatFileSize(file.size)}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Shield className="size-3" />
                      <span>文件权限</span>
                    </div>
                    <div className="text-sm font-medium font-mono">{file.permissions}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <File className="size-3" />
                      <span>文件类型</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={file.type === "directory" ? "default" : "secondary"}>
                        {file.type === "directory" ? "目录" : "文件"}
                      </Badge>
                      {file.type === "file" && (
                        <Badge variant="outline">{getFileTypeCategory(file.name)}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  {file.type === "file" && (
                    <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
                      {previewLoading ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="size-4 mr-2" />
                      )}
                      预览内容
                    </Button>
                  )}
                  {file.type === "file" && (
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="size-4 mr-2" />
                      下载
                    </Button>
                  )}
                  <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="size-4 mr-2" />
                    删除
                  </Button>
                </div>

                {/* 预览内容 */}
                {previewLoading && (
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-lg" />
                  </div>
                )}

                {previewError && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                    {previewError}
                  </div>
                )}

                {previewContent && !previewLoading && !previewError && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-medium text-sm">文件内容</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatFileSize(previewContent.length)}
                      </span>
                    </div>
                    <div className="bg-muted/30 rounded-lg border">
                      <pre className="text-xs p-4 overflow-auto max-h-[500px]">
                        <code className="text-muted-foreground whitespace-pre-wrap break-all font-mono">
                          {previewContent.slice(0, 10000)}
                          {previewContent.length > 10000 && (
                            <span className="text-muted-foreground">
                              {"\n\n... (内容过长，已截断显示)"}
                            </span>
                          )}
                        </code>
                      </pre>
                    </div>
                  </div>
                )}

                {/* 删除错误 */}
                {deleteError && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                    {deleteError}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除 {file?.name} 吗？
              {file?.type === "directory" && (
                <span className="text-red-500 block mt-2">
                  注意：删除目录将删除目录下的所有文件和子目录，此操作不可恢复。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteLoading ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}