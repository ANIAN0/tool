"use client";

/**
 * 左侧对话列表组件
 * 显示历史对话列表，支持新建对话按钮
 * 功能点13：左侧对话列表组件
 * 功能点14：集成对话列表项组件
 */

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarItem } from "./sidebar-item";
import type { Conversation } from "@/lib/db/schema";
import { MessageSquarePlus, PanelLeftClose } from "lucide-react";

/**
 * Sidebar组件的Props
 */
interface SidebarProps {
  // 对话列表数据
  conversations: Conversation[];
  // 当前选中的对话ID
  currentConversationId: string | null;
  // 新建对话回调
  onNewChat: () => void;
  // 选择对话回调
  onSelectConversation: (id: string) => void;
  // 删除对话回调
  onDeleteConversation: (id: string) => void;
  // 重命名对话回调
  onRenameConversation: (id: string, newTitle: string) => void;
  // 关闭侧边栏回调（移动端使用）
  onClose?: () => void;
  // 是否加载中
  isLoading?: boolean;
}

/**
 * 左侧对话列表组件
 */
export function Sidebar({
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
      <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-sm">对话列表</h2>
        {/* 移动端关闭按钮 */}
        {onClose && (
          <Button
            className="md:hidden"
            onClick={onClose}
            size="icon-xs"
            variant="ghost"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      {/* 新建对话按钮 */}
      <div className="shrink-0 p-2">
        <Button
          className="w-full justify-start gap-2"
          onClick={onNewChat}
          variant="outline"
        >
          <MessageSquarePlus className="size-4" />
          <span>新建对话</span>
        </Button>
      </div>

      {/* 对话列表区域 */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {/* 加载中状态 */}
          {isLoading && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              加载中...
            </div>
          )}

          {/* 空状态 */}
          {!isLoading && conversations.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              暂无对话记录
              <br />
              点击上方按钮开始新对话
            </div>
          )}

          {/* 对话列表 */}
          {!isLoading &&
            conversations.map((conversation) => (
              <SidebarItem
                isSelected={currentConversationId === conversation.id}
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                onDelete={onDeleteConversation}
                onRename={onRenameConversation}
                conversation={conversation}
              />
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
