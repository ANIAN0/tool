"use client";

/**
 * AgentChat侧边栏组件
 * 显示Agent对话历史列表
 */

import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/db/schema";
import { MessageSquarePlus, PanelLeftClose, BotIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * SidebarProps
 */
interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onClose?: () => void;
  isLoading?: boolean;
}

/**
 * 对话项组件
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
        group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer
        hover:bg-accent transition-colors
        ${isSelected ? "bg-accent" : ""}
      `}
      onClick={onClick}
    >
      <BotIcon className="size-4 shrink-0 text-muted-foreground" />

      {isEditing ? (
        <Input
          className="h-6 text-sm"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleRename();
            } else if (e.key === "Escape") {
              setIsEditing(false);
            }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate text-sm">
          {conversation.title || "新对话"}
        </span>
      )}

      {/* 操作按钮 */}
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          className="p-1 hover:bg-accent rounded"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          className="p-1 hover:bg-destructive/20 rounded text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
        >
          <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * AgentChat侧边栏组件
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
      {/* 侧边栏头部 */}
      <div className="flex shrink-0 h-16 items-center justify-between border-b border-border px-4">
        <h2 className="font-semibold text-sm text-foreground">Agent对话</h2>
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

      {/* 新建对话按钮 */}
      <div className="shrink-0 px-4 py-3">
        <Button
          className="w-full justify-center gap-2"
          onClick={onNewChat}
          variant="outline"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>新Agent对话</span>
        </Button>
      </div>

      {/* 对话列表区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <div className="space-y-1">
          {isLoading && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              加载中...
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              暂无Agent对话记录
              <br />
              选择Agent开始对话
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