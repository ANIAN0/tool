"use client";

/**
 * 对话列表项组件
 * 单个对话项，显示标题、时间，支持删除和重命名操作
 * 功能点14：对话列表项组件
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * SidebarItem组件的Props
 */
interface SidebarItemProps {
  // 对话数据
  conversation: Conversation;
  // 是否选中
  isSelected: boolean;
  // 点击回调
  onClick: () => void;
  // 删除回调
  onDelete: (id: string) => void;
  // 重命名回调
  onRename: (id: string, newTitle: string) => void;
}

/**
 * 格式化时间显示
 * 显示相对时间（今天、昨天、更早）
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 今天
  if (diffDays === 0) {
    return `今天 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }

  // 昨天
  if (diffDays === 1) {
    return "昨天";
  }

  // 一周内
  if (diffDays < 7) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return weekdays[date.getDay()];
  }

  // 更早
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 对话列表项组件
 */
export function SidebarItem({
  conversation,
  isSelected,
  onClick,
  onDelete,
  onRename,
}: SidebarItemProps) {
  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false);
  // 编辑中的标题
  const [editTitle, setEditTitle] = useState(conversation.title || "");
  // 删除确认对话框状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // 输入框ref
  const inputRef = useRef<HTMLInputElement>(null);

  // 进入编辑模式时聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 初始化时设置标题，避免在render期间调用setState
  // 标题变化通过handleStartEdit和handleCancelEdit处理

  // 处理开始编辑
  const handleStartEdit = () => {
    setEditTitle(conversation.title || "");
    setIsEditing(true);
  };

  // 处理保存编辑
  const handleSaveEdit = () => {
    const trimmedTitle = editTitle.trim();
    // 只有标题有变化时才保存
    if (trimmedTitle && trimmedTitle !== conversation.title) {
      onRename(conversation.id, trimmedTitle);
    }
    setIsEditing(false);
  };

  // 处理取消编辑
  const handleCancelEdit = () => {
    setEditTitle(conversation.title || "");
    setIsEditing(false);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // 处理确认删除
  const handleConfirmDelete = () => {
    onDelete(conversation.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div
        className={cn(
          // 添加 overflow-hidden 确保 truncate 生效，防止内容溢出将菜单按钮挤出容器
          "group relative flex items-center gap-3 overflow-hidden rounded-md px-4 py-3 text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
          isSelected && "bg-accent text-accent-foreground"
        )}
      >
        {/* 点击区域 - 编辑模式下隐藏 */}
        {!isEditing && (
          <button
            className="flex-1 truncate text-left"
            onClick={onClick}
          >
            <div className="truncate font-medium">
              {conversation.title || "新对话"}
            </div>
            <div className="mt-1 text-muted-foreground text-xs">
              {formatTime(conversation.updated_at)}
            </div>
          </button>
        )}

        {/* 编辑模式 */}
        {isEditing && (
          <div className="flex flex-1 items-center gap-2">
            <Input
              className="h-8 text-sm"
              onBlur={handleSaveEdit}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              value={editTitle}
            />
            {/* 取消编辑按钮 */}
            <Button
              className="shrink-0"
              onClick={handleCancelEdit}
              size="icon-sm"
              variant="ghost"
            >
              ✕
            </Button>
          </div>
        )}

        {/* 操作按钮 - 悬停时显示，编辑模式下隐藏 */}
        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className={cn(
                  "shrink-0 opacity-0 group-hover:opacity-100",
                  "focus:opacity-100",
                  isSelected && "opacity-100"
                )}
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right">
              {/* 重命名选项 */}
              <DropdownMenuItem onClick={handleStartEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                <span>重命名</span>
              </DropdownMenuItem>
              {/* 删除选项 */}
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                variant="destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                <span>删除</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 删除确认对话框 */}
      <Dialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除对话「{conversation.title || "新对话"}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setShowDeleteDialog(false)}
              variant="outline"
            >
              取消
            </Button>
            <Button onClick={handleConfirmDelete} variant="destructive">
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
