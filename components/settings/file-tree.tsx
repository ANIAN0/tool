/**
 * 文件树组件
 * 展示目录内容
 * 支持点击目录进入，点击文件选中
 */

"use client";

import { cn } from "@/lib/utils";
import { Folder, File, FileText, FileCode } from "lucide-react";
import type { FileEntry } from "./file-manager";

// 文件树组件属性
interface FileTreeProps {
  files: FileEntry[];
  currentPath: string;
  selectedFile: FileEntry | null;
  onSelect: (entry: FileEntry) => void;
}

/**
 * 根据文件名判断文件图标类型
 */
function getFileIcon(name: string, type: "file" | "directory") {
  // 目录使用文件夹图标
  if (type === "directory") {
    return <Folder className="h-4 w-4 text-blue-500" />;
  }

  // 根据文件扩展名选择图标
  const ext = name.split(".").pop()?.toLowerCase();

  // 代码文件
  if (["js", "ts", "jsx", "tsx", "py", "rb", "go", "java", "c", "cpp", "h"].includes(ext || "")) {
    return <FileCode className="h-4 w-4 text-green-500" />;
  }

  // 文本文件
  if (["md", "txt", "json", "yaml", "yml", "xml", "csv", "log"].includes(ext || "")) {
    return <FileText className="h-4 w-4 text-orange-500" />;
  }

  // 默认文件图标
  return <File className="h-4 w-4 text-gray-500" />;
}

/**
 * 格式化文件大小显示
 */
function formatFileSize(size: number): string {
  if (size === 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 文件树组件
 */
export function FileTree({ files, currentPath, selectedFile, onSelect }: FileTreeProps) {
  // 空目录显示
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {currentPath === "/" ? (
          <div>
            <p className="mb-2">沙盒工作区暂无文件</p>
            <p className="text-xs">
              Agent 执行任务时创建的文件将显示在此处
            </p>
          </div>
        ) : (
          <p>当前目录为空</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* 文件列表 */}
      {files.map((entry) => (
        <div
          key={entry.path}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer",
            "hover:bg-muted transition-colors",
            selectedFile?.path === entry.path && "bg-muted"
          )}
          onClick={() => onSelect(entry)}
          title={entry.type === "directory" ? `进入 ${entry.name}` : `查看 ${entry.name}`}
        >
          {/* 文件图标 */}
          {getFileIcon(entry.name, entry.type)}

          {/* 文件名 */}
          <span className="flex-1 truncate font-medium">
            {entry.name}
          </span>

          {/* 文件大小（仅文件显示） */}
          {entry.type === "file" && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(entry.size)}
            </span>
          )}

          {/* 类型标记 */}
          <span className="text-xs text-muted-foreground">
            {entry.type === "directory" ? "目录" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}