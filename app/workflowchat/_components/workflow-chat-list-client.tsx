"use client";

/**
 * WorkflowChat 会话列表客户端组件
 * 接收 userId 作为 props，使用 authenticatedFetch 调用 API
 *
 * 集成功能：
 * - Agent 选择器：创建会话时选择 Agent
 * - 会话列表：显示关联的 Agent 信息
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";
import { AgentSelector, useAgents, type AgentInfo } from "@/components/workflowchat";

/** 会话 DTO — 与后端 ConversationDTO 对齐 */
interface ConversationDTO {
  id: string;
  userId: string | null;
  agentId: string; // 关联的 Agent ID
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

/** WorkflowChatListClient Props */
interface WorkflowChatListClientProps {
  // 已验证的用户 ID（从 Server Component 传入）
  userId: string;
}

/**
 * WorkflowChat 会话列表客户端组件
 * 展示已有会话、支持创建新会话
 * 集成 Agent 选择器用于创建会话时选择 Agent
 */
export function WorkflowChatListClient({ userId }: WorkflowChatListClientProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent 选择状态
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  // 使用 useAgents hook 获取 Agent 列表（用于会话列表显示 Agent 信息）
  const { agents, isLoading: isLoadingAgents, getAgentById } = useAgents();

  // 获取会话列表（使用 authenticatedFetch 携带 Token）
  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch("/api/workflowchat/conversations");
      if (!res.ok) {
        // 检查是否是认证错误
        if (res.status === 401) {
          router.push("/login");
          return;
        }
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
  }, [router]);

  // 创建新会话并跳转（使用 authenticatedFetch 携带 Token）
  // 需要先选择 Agent
  const handleCreate = useCallback(async () => {
    // 验证是否已选择 Agent
    if (!selectedAgentId) {
      setError("请先选择 Agent");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await authenticatedFetch("/api/workflowchat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: null,
          agentId: selectedAgentId, // 使用用户选择的 Agent ID
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
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
  }, [router, selectedAgentId]);

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

  // 根据 Agent ID 获取 Agent 信息用于显示
  const getAgentName = (agentId: string): string => {
    const agent = getAgentById(agentId);
    return agent?.name || agentId;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Workflow Chat</h1>
        <div className="flex items-center gap-3">
          {/* Agent 选择器 */}
          <AgentSelector
            selectedId={selectedAgentId}
            onSelect={(agentId) => {
              setSelectedAgentId(agentId);
              setError(null); // 清除错误
            }}
            disabled={creating}
            loading={isLoadingAgents}
            placeholder="选择 Agent"
            size="default"
          />
          {/* 新建会话按钮 */}
          <button
            onClick={handleCreate}
            disabled={creating || !selectedAgentId}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {creating ? "创建中…" : "新建会话"}
          </button>
        </div>
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
            <p className="mt-2 text-sm">选择 Agent 后点击"新建会话"开始聊天</p>
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
                  <div className="flex items-center gap-2">
                    {/* 会话标题 */}
                    <span className="truncate text-sm font-medium text-card-foreground">
                      {conv.title || "无标题会话"}
                    </span>
                    {/* Agent 信息显示 */}
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {getAgentName(conv.agentId)}
                    </span>
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