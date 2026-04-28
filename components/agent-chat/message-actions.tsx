"use client";

/**
 * 消息操作栏组件
 * 在消息下方显示 token 使用情况和操作按钮
 *
 * 提供显式变体组件，避免隐式条件渲染：
 * - AssistantMessageActions: 显示 token 统计和复制按钮
 * - UserMessageActions: 显示复制、编辑、删除按钮
 */

import { Button } from "@/components/ui/button";
import { Trash2Icon, PencilIcon, CopyIcon, CheckIcon } from "lucide-react";
import type { LanguageModelUsage } from "ai";
import { useState } from "react";
import type { MessageMetadata } from "@/lib/agent-chat/utils";

// 重新导出 MessageMetadata 供组件使用
export type { MessageMetadata };

// Token统计类型（从数据库获取，用于历史消息）
export type TokenStats = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

/**
 * 格式化 token 数量
 */
function formatTokens(tokens: number | null | undefined): string {
  if (tokens === undefined || tokens === null) return "-";
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

// ==================== Assistant 消息操作变体 ====================

interface AssistantMessageActionsProps {
  // 消息内容（用于复制）
  content?: string;
  // 消息元数据（流式响应时使用）
  metadata?: MessageMetadata;
  // 是否正在生成
  isGenerating?: boolean;
  // Token统计（从数据库获取）
  tokenStats?: TokenStats;
}

/**
 * Assistant 消息操作栏
 * 显示 token 统计信息和复制按钮
 */
export function AssistantMessageActions({
  content,
  metadata,
  isGenerating,
  tokenStats,
}: AssistantMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  // 优先使用实时 metadata，否则使用数据库的 tokenStats
  const inputTokens = metadata?.usage?.inputTokens ?? tokenStats?.inputTokens;
  const outputTokens = metadata?.usage?.outputTokens ?? tokenStats?.outputTokens;
  const totalTokens = metadata?.usage?.totalTokens ?? tokenStats?.totalTokens;

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {/* Token 使用信息 */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide opacity-60">Input</span>
          <span className="font-mono">{formatTokens(inputTokens)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide opacity-60">Output</span>
          <span className="font-mono">{formatTokens(outputTokens)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide opacity-60">Total</span>
          <span className="font-mono font-medium">{formatTokens(totalTokens)}</span>
        </span>
      </div>

      {/* 复制按钮 */}
      {content ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          disabled={isGenerating}
          title={copied ? "已复制" : "复制消息"}
        >
          {copied ? (
            <CheckIcon className="h-3 w-3 text-green-500" />
          ) : (
            <CopyIcon className="h-3 w-3" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

// ==================== User 消息操作变体 ====================

interface UserMessageActionsProps {
  // 消息内容（用于复制）
  content?: string;
  // 是否正在生成
  isGenerating?: boolean;
  // 删除回调
  onDelete?: () => void;
  // 编辑回调
  onEdit?: () => void;
}

/**
 * User 消息操作栏
 * 显示复制、编辑、删除按钮
 */
export function UserMessageActions({
  content,
  isGenerating,
  onDelete,
  onEdit,
}: UserMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground">
      {/* 复制按钮 */}
      {content ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          disabled={isGenerating}
          title={copied ? "已复制" : "复制消息"}
        >
          {copied ? (
            <CheckIcon className="h-3 w-3 text-green-500" />
          ) : (
            <CopyIcon className="h-3 w-3" />
          )}
        </Button>
      ) : null}

      {/* 编辑按钮 */}
      {onEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onEdit}
          disabled={isGenerating}
          title="编辑消息"
        >
          <PencilIcon className="h-3 w-3" />
        </Button>
      ) : null}

      {/* 删除按钮 */}
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isGenerating}
          title="删除消息"
        >
          <Trash2Icon className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
}

// ==================== 通用 MessageActions（向后兼容） ====================

interface MessageActionsProps {
  // 消息角色
  role: "user" | "assistant" | "system";
  // 消息内容（用于复制）
  content?: string;
  // 消息元数据（仅 assistant 消息有，流式响应时使用）
  metadata?: MessageMetadata;
  // 是否正在生成
  isGenerating?: boolean;
  // 删除回调
  onDelete?: () => void;
  // 编辑回调（仅 user 消息）
  onEdit?: () => void;
  // Token统计（从数据库获取，用于历史消息显示）
  tokenStats?: TokenStats;
}

/**
 * 消息操作栏组件（向后兼容）
 * 根据 role 自动选择对应的变体组件
 */
export function MessageActions({
  role,
  content,
  metadata,
  isGenerating,
  onDelete,
  onEdit,
  tokenStats,
}: MessageActionsProps) {
  if (role === "assistant") {
    return (
      <AssistantMessageActions
        content={content}
        metadata={metadata}
        isGenerating={isGenerating}
        tokenStats={tokenStats}
      />
    );
  }

  if (role === "user") {
    return (
      <UserMessageActions
        content={content}
        isGenerating={isGenerating}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    );
  }

  // system 消息不显示操作栏
  return null;
}