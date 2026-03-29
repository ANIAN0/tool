/**
 * 文件详情组件
 * 展示文件信息
 * 支持预览、下载、删除操作
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  FileText,
  FileCode,
  Image,
  Settings,
  FolderZip,
  File,
} from "lucide-react";
import type { FileEntry } from "./file-manager";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";
// 导入公共文件工具函数
import { formatFileSize, isPreviewable, getFileTypeCategory } from "@/lib/utils/file-utils";

// 文件详情组件属性
interface FileDetailProps {
  file: FileEntry;
  sessionId: string;
  onDeleteSuccess: () => void;
}

/**
 * 获取文件图标（根据文件类型返回对应的图标组件）
 * 使用公共的 getFileTypeCategory 函数判断文件类型
 */
function getFileIcon(name: string) {
  // 根据文件类型获取对应图标
  const category = getFileTypeCategory(name);

  switch (category) {
    case "code":
      // 代码文件图标
      return <FileCode className="h-6 w-6 text-green-500" />;
    case "text":
      // 文本文件图标
      return <FileText className="h-6 w-6 text-orange-500" />;
    case "config":
      // 配置文件图标
      return <Settings className="h-6 w-6 text-blue-500" />;
    case "image":
      // 图片文件图标
      return <Image className="h-6 w-6 text-purple-500" />;
    case "archive":
      // 压缩文件图标
      return <FolderZip className="h-6 w-6 text-yellow-500" />;
    default:
      // 默认文件图标
      return <File className="h-6 w-6 text-gray-500" />;
  }
}

/**
 * 文件详情组件
 */
export function FileDetail({ file, sessionId, onDeleteSuccess }: FileDetailProps) {
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
    try {
      setPreviewLoading(true);
      setPreviewError(null);

      // 构建请求 URL
      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}&action=download`;

      // 发送认证请求下载文件
      const response = await authenticatedFetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "获取文件内容失败");
      }

      // 获取文件内容
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
    try {
      // 构建请求 URL
      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}&action=download`;

      // 发送认证请求下载文件
      const response = await authenticatedFetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "下载文件失败");
      }

      // 获取文件内容
      const content = await response.text();

      // 创建下载链接
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
    try {
      setDeleteLoading(true);
      setDeleteError(null);

      // 构建请求 URL
      const url = `/api/sandbox/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}`;

      // 发送认证请求删除文件
      const response = await authenticatedFetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "删除文件失败");
      }

      // 删除成功，关闭对话框并触发回调
      setDeleteDialogOpen(false);
      onDeleteSuccess();
    } catch (err) {
      console.error("删除文件失败:", err);
      setDeleteError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 文件基本信息 */}
      <div className="flex items-start gap-4">
        {/* 文件图标 */}
        {getFileIcon(file.name)}

        {/* 文件名和类型 */}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{file.name}</h3>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">
              {file.type === "directory" ? "目录" : "文件"}
            </Badge>
            {file.type === "file" && (
              <Badge variant="secondary">
                {formatFileSize(file.size)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* 文件详细信息 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">路径：</span>
          <code className="text-blue-600 ml-2">{file.path}</code>
        </div>
        <div>
          <span className="text-muted-foreground">权限：</span>
          <code className="ml-2">{file.permissions}</code>
        </div>
        <div>
          <span className="text-muted-foreground">修改时间：</span>
          <span className="ml-2">{file.modifiedTime}</span>
        </div>
        <div>
          <span className="text-muted-foreground">文件大小：</span>
          <span className="ml-2">{formatFileSize(file.size)}</span>
        </div>
      </div>

      <Separator />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {/* 预览按钮（仅文件可预览） */}
        {file.type === "file" && isPreviewable(file.name) && (
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewLoading}
          >
            {previewLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            预览
          </Button>
        )}

        {/* 下载按钮 */}
        <Button
          variant="outline"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          下载
        </Button>

        {/* 删除按钮 */}
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          删除
        </Button>
      </div>

      {/* 预览内容 */}
      {previewContent && (
        <div className="mt-4">
          <Separator />
          <div className="mt-4">
            <h4 className="font-medium mb-2">文件内容预览</h4>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[400px] whitespace-pre-wrap">
              {previewContent.slice(0, 10000)} {/* 限制预览长度 */}
              {previewContent.length > 10000 && (
                <span className="text-muted-foreground">
                  {"\n\n... (内容过长，已截断显示)"}
                </span>
              )}
            </pre>
          </div>
        </div>
      )}

      {/* 预览错误 */}
      {previewError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除 {file.name} 吗？
              {file.type === "directory" && (
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除错误 */}
      {deleteError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}