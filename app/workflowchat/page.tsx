"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** 会话 DTO — 与后端 ConversationDTO 对齐 */
interface ConversationDTO {
  id: string;
  userId: string | null;
  title: string | null;
  status: string;
  activeStreamId: string | null;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
}

/** 会话列表响应 */
interface ConversationsResponse {
  conversations: ConversationDTO[];
}

/**
 * WorkflowChat 会话列表页
 * 展示已有会话、支持创建新会话
 */
export default function WorkflowChatListPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取会话列表
  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workflowchat/conversations");
      if (!res.ok) {
        throw new Error(`获取会话列表失败: ${res.status}`);
      }
      const data: ConversationsResponse = await res.json();
      setConversations(data.conversations ?? []);
    } catch (err) {
      console.error("[workflowchat] 获取会话列表失败:", err);
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建新会话并跳转
  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workflowchat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: null }),
      });
      if (!res.ok) {
        throw new Error(`创建会话失败: ${res.status}`);
      }
      const conv: ConversationDTO = await res.json();
      // 跳转到聊天页
      router.push(`/workflowchat/${conv.id}`);
    } catch (err) {
      console.error("[workflowchat] 创建会话失败:", err);
      setError(err instanceof Error ? err.message : "未知错误");
      setCreating(false);
    }
  }, [router]);

  // 页面加载时获取会话列表
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 格式化时间戳
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Workflow Chat</h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {creating ? "创建中…" : "新建会话"}
        </button>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 px-6 py-4">
        {loading && (
          <div className="animate-pulse text-muted-foreground">加载中…</div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-lg">暂无会话</p>
            <p className="mt-2 text-sm">点击"新建会话"开始聊天</p>
          </div>
        )}

        {!loading && conversations.length > 0 && (
          <div className="grid gap-3">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => router.push(`/workflowchat/${conv.id}`)}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-card-foreground">
                    {conv.title || "无标题会话"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {conv.status === "active" ? "活跃" : conv.status}
                    {" · "}
                    {formatTime(conv.updatedAt)}
                  </div>
                </div>
                <span className="ml-2 text-xs text-muted-foreground">→</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}