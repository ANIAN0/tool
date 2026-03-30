/**
 * Skill 上传对话框组件
 * 支持选择 Skill 目录进行上传
 */

"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FolderOpen } from "lucide-react";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

interface SkillUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SkillUploadDialog({ open, onOpenChange, onSuccess }: SkillUploadDialogProps) {
  // 存储选择的文件列表
  const [files, setFiles] = useState<File[] | null>(null);
  // 上传状态
  const [uploading, setUploading] = useState(false);
  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 文件输入框引用
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理目录选择
   * 验证目录是否包含 SKILL.md 文件
   */
  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // 获取文件列表和相对路径
    const fileArray = Array.from(selectedFiles);
    const paths = fileArray.map(f => f.webkitRelativePath);

    // 检查是否包含 SKILL.md 文件（必须存在于目录中）
    const hasSkillMd = paths.some(p =>
      p.endsWith('SKILL.md') || p.split('/').pop() === 'SKILL.md'
    );

    if (!hasSkillMd) {
      setError('Skill 目录必须包含 SKILL.md 文件');
      return;
    }

    // 设置文件列表并清除错误
    setFiles(fileArray);
    setError(null);
  };

  /**
   * 执行上传操作
   * 将目录中的所有文件上传到服务器
   */
  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setError("请选择 Skill 目录");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // 构建表单数据
      const formData = new FormData();

      // 添加所有文件到表单
      files.forEach(file => {
        formData.append("files", file);
      });

      // 添加文件路径信息（JSON格式）
      const paths = files.map(f => f.webkitRelativePath);
      formData.append("paths", JSON.stringify(paths));

      // 发送上传请求（使用带自动刷新的认证请求）
      // 注意：FormData 不能设置 Content-Type，让浏览器自动处理
      const response = await authenticatedFetch("/api/skills", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // 上传成功，清空文件列表
        setFiles(null);
        onSuccess();
      } else {
        // 显示错误信息
        setError(data.error?.message || "上传失败");
      }
    } catch (err) {
      console.error("上传失败:", err);
      setError("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  /**
   * 关闭对话框时清空状态
   */
  const handleClose = () => {
    setFiles(null);
    setError(null);
    onOpenChange(false);
  };

  /**
   * 获取目录名称
   * 从第一个文件的相对路径中提取
   */
  const getDirectoryName = (): string | null => {
    if (!files || files.length === 0) return null;
    const firstPath = files[0].webkitRelativePath;
    // 路径格式为 "目录名/文件名"，提取目录名
    return firstPath.split('/')[0];
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>上传 Skill</DialogTitle>
          <DialogDescription>
            选择包含 SKILL.md 文件的 Skill 目录进行上传
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 目录选择区域 */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {/* 使用 webkitdirectory 属性支持目录选择 */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <input
              ref={fileInputRef}
              type="file"
              {...({ webkitdirectory: "" } as any)}
              className="hidden"
              onChange={handleDirectorySelect}
            />
            {files ? (
              // 显示已选择的目录信息
              <div className="flex items-center justify-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{getDirectoryName()}</span>
                <span className="text-muted-foreground text-sm">
                  ({files.length} 个文件)
                </span>
              </div>
            ) : (
              // 显示选择提示
              <div className="text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2" />
                <p>点击选择 Skill 目录</p>
                <p className="text-xs mt-1">目录必须包含 SKILL.md 文件</p>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button onClick={handleUpload} disabled={!files || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                "上传"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}