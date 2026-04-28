"use client";

/**
 * AgentChat侧边栏组件
 * 极简设计：安静的辅助工具，不抢夺注意力
 */

import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/schemas";
import { MessageSquarePlus, PanelLeftClose, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * 格式化 token 总量显示
 */
function formatTotalTokens(total: number): string {
  if (total >= 1000000) {
    return `${(total / 1000000).toFixed(1)}M`;
  }
  if (total >= 1000) {
    return `${(total / 1000).toFixed(1)}K`;
  }
  return total.toString();
}

/**
 * SidebarProps
 */
interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onRenameConversation: (id: string, newTitle: string) => void;
  onClose?: () => void;
  isLoading?: boolean;
}

/**
 * 对话项组件
 * 极简设计：去除图标装饰，聚焦内容本身
 */
function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onDelete,
  onRename,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title || "");

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(conversation.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      className={`
        group flex flex-col gap-0.5 rounded-lg px-3 py-2.5 cursor-pointer
        transition-colors duration-150
        ${isSelected
          ? "bg-accent/80 text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {isEditing ? (
          // 编辑状态：简洁的输入框
          <Input
            className="h-7 text-sm bg-background border-0 focus-visible:ring-1"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRename();
              } else if (e.key === "Escape") {
                setIsEditing(false);
                setEditTitle(conversation.title || "");
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          // 标题显示：去除图标，更干净
          <span className="flex-1 truncate text-sm font-medium">
            {conversation.title || "新对话"}
          </span>
        )}

        {/* 操作按钮：hover时显示，简洁的ghost风格 */}
        {!isEditing && (
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="重命名"
            >
              <Pencil className="size-3 opacity-60" />
            </button>
            <button
              className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors text-destructive/70 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conversation.id);
              }}
              title="删除"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Token 总消耗：更小巧、更淡的颜色 */}
      {conversation.total_tokens > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 ml-0 mt-0.5">
          <span className="font-mono">{formatTotalTokens(conversation.total_tokens)}</span>
          <span>tokens</span>
        </div>
      )}
    </div>
  );
}

/**
 * AgentChat侧边栏组件
 * 极简设计：安静的辅助工具区域
 */
export function AgentChatSidebar({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onClose,
  isLoading = false,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 侧边栏头部：去掉边框，使用微妙的分隔 */}
      <div className="flex shrink-0 h-14 items-center justify-between px-4">
        <h2 className="font-medium text-sm text-foreground/80">对话历史</h2>
        {onClose && (
          <Button
            className="md:hidden"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 新建对话按钮：简洁的ghost风格 */}
      <div className="shrink-0 px-3 py-2">
        <Button
          className="w-full justify-center gap-2 bg-accent/50 hover:bg-accent/80 border-0"
          onClick={onNewChat}
          variant="ghost"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span className="text-sm">新对话</span>
        </Button>
      </div>

      {/* 对话列表区域：更干净的列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2">
        <div className="space-y-0.5">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground/60 text-sm">
              加载中...
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <div className="py-8 text-center text-muted-foreground/60 text-sm">
              开始你的第一个对话
            </div>
          )}

          {!isLoading &&
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={currentConversationId === conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                onDelete={onDeleteConversation}
                onRename={onRenameConversation}
              />
            ))}
        </div>
      </div>
    </div>
  );
}