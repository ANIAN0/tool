"use client";

/**
 * WorkflowChat 消息操作栏组件
 * 在消息下方显示操作按钮
 */

import { Button } from "@/components/ui/button";
import { Trash2Icon, PencilIcon, CopyIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import type { WorkflowChatMessageMetadata } from "./workflow-chat-context";

export type { WorkflowChatMessageMetadata };

interface AssistantMessageActionsProps {
  content?: string;
  metadata?: WorkflowChatMessageMetadata;
  isGenerating?: boolean;
}

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

export function AssistantMessageActions({
  content,
  metadata,
  isGenerating,
}: AssistantMessageActionsProps) {
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

  const inputTokens = metadata?.usage?.inputTokens;
  const outputTokens = metadata?.usage?.outputTokens;
  const totalTokens = metadata?.usage?.totalTokens;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

interface UserMessageActionsProps {
  content?: string;
  isGenerating?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}

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

interface MessageActionsProps {
  role: "user" | "assistant" | "system";
  content?: string;
  metadata?: WorkflowChatMessageMetadata;
  isGenerating?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function MessageActions({
  role,
  content,
  metadata,
  isGenerating,
  onDelete,
  onEdit,
}: MessageActionsProps) {
  if (role === "assistant") {
    return (
      <AssistantMessageActions
        content={content}
        metadata={metadata}
        isGenerating={isGenerating}
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

  return null;
}
