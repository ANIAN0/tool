"use client";

/**
 * WorkflowChat 聊天详情客户端组件
 * 接收 userId 和 conversationId 作为 props，使用 authenticatedFetch 调用 API
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

/** 会话详情响应 — 与后端 ConversationDetailDTO 对齐 */
interface ConversationDetailDTO {
  conversation: {
    id: string;
    title: string | null;
    status: string;
  };
  messages: {
    id: string;
    role: "user" | "assistant" | "system";
    parts: string;
    createdAt: number;
  }[];
  activeStreamId: string | null;
}

/** WorkflowChatClient Props */
interface WorkflowChatClientProps {
  // 已验证的用户 ID（从 Server Component 传入）
  userId: string;
  // 会话 ID
  conversationId: string;
}

/**
 * WorkflowChat 多轮聊天客户端组件
 * 使用 AI SDK useChat hook，支持流式回复和多轮对话
 * 支持页面刷新后通过 activeStreamId 重连 stream
 */
export function WorkflowChatClient({ userId, conversationId }: WorkflowChatClientProps) {
  const router = useRouter();

  // 是否已加载初始消息
  const [initialLoaded, setInitialLoaded] = useState(false);
  // 是否正在加载历史
  const [loadingHistory, setLoadingHistory] = useState(true);
  // 错误提示
  const [error, setError] = useState<string | null>(null);
  // 输入框内容
  const [input, setInput] = useState("");

  // 存储当前活跃的 stream ID，供 transport 重连时使用
  const activeStreamIdRef = useRef<string | null>(null);

  // useChat transport 配置
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/workflowchat/conversations/${conversationId}/messages`,
        // 将 useChat 最后一条消息转为后端期望的 { content, modelId } 格式
        prepareSendMessagesRequest({ messages }) {
          const lastMsg = messages[messages.length - 1];
          // 从消息 parts 中提取纯文本内容
          const textContent =
            lastMsg?.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n") ?? "";
          return {
            body: {
              content: textContent,
            },
          };
        },
        // 页面刷新恢复：根据 activeStreamId 构造 stream 重连 URL
        prepareReconnectToStreamRequest({ id }) {
          const runId = activeStreamIdRef.current;
          if (!runId) {
            // 无活跃 stream，不发起重连请求
            return {};
          }
          return {
            api: `/api/workflowchat/conversations/${id}/runs/${runId}/stream`,
          };
        },
      }),
    [conversationId]
  );

  // useChat hook — 核心聊天功能
  const { messages, sendMessage, status, setMessages, resumeStream } = useChat({
    transport,
    id: conversationId,
  });

  // 消息列表底部滚动标记
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载历史消息（使用 authenticatedFetch 携带 Token）
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoadingHistory(true);
      setError(null);
      try {
        const res = await authenticatedFetch(
          `/api/workflowchat/conversations/${conversationId}`
        );
        if (!res.ok) {
          // 检查是否是认证错误
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          // 检查是否是权限错误
          if (res.status === 403) {
            setError("无权访问该会话");
            setInitialLoaded(true);
            setLoadingHistory(false);
            return;
          }
          throw new Error(`加载会话失败: ${res.status}`);
        }
        const data: ConversationDetailDTO = await res.json();

        // 将后端消息转为 UIMessage 格式
        const uiMessages: UIMessage[] = (data.messages ?? []).map((msg) => {
          let parts: UIMessage["parts"];
          try {
            parts = JSON.parse(msg.parts);
          } catch {
            // 解析失败时退化为纯文本
            parts = [{ type: "text" as const, text: msg.parts }];
          }

          return {
            id: msg.id,
            role: msg.role as UIMessage["role"],
            parts,
            createdAt: new Date(msg.createdAt),
          };
        });

        if (!cancelled) {
          setMessages(uiMessages);
          setInitialLoaded(true);

          // 刷新恢复：检测 activeStreamId，重连活跃 stream
          const activeStreamId = data.activeStreamId;
          if (activeStreamId) {
            activeStreamIdRef.current = activeStreamId;
            // resumeStream 内部会通过 prepareReconnectToStreamRequest 构造重连 URL
            // 若 run 已终态，stream 端点返回 204，resumeStream 静默返回
            resumeStream().catch((err) => {
              console.error("[workflowchat] 刷新恢复重连失败:", err);
            });
          }
        }
      } catch (err) {
        console.error("[workflowchat] 加载历史消息失败:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "未知错误");
          setInitialLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [conversationId, setMessages, resumeStream, router]);

  // 发送消息
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;
      setInput("");
      setError(null);

      try {
        await sendMessage({ text: trimmed });
      } catch (err) {
        console.error("[workflowchat] 发送消息失败:", err);
        setError(err instanceof Error ? err.message : "发送失败");
      }
    },
    [input, sendMessage]
  );

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 是否正在生成
  const isGenerating = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶部栏 */}
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <button
          onClick={() => router.push("/workflowchat")}
          className="inline-flex h-8 items-center justify-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          ← 返回
        </button>
        <h1 className="text-sm font-medium text-foreground">
          Workflow Chat
        </h1>
      </header>

      {/* 消息列表区域 */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loadingHistory && !initialLoaded && (
          <div className="animate-pulse text-muted-foreground">加载历史消息…</div>
        )}

        {error && !loadingHistory && messages.length === 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {messages.length === 0 && !loadingHistory && !error && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            输入消息开始对话
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {/* 渲染消息 parts */}
              {msg.parts?.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <span key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </span>
                  );
                }
                // 其他 part 类型用 JSON 显示
                return (
                  <pre key={i} className="mt-1 overflow-x-auto text-xs opacity-70">
                    {JSON.stringify(part, null, 2)}
                  </pre>
                );
              })}
            </div>
          </div>
        ))}

        {/* 流式生成中的状态提示 */}
        {isGenerating && (
          <div className="mb-4 flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
              <span className="inline-block animate-pulse">正在思考…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 输入区域 */}
      <div className="border-t px-4 py-3">
        {/* 错误提示（发送失败时） */}
        {error && messages.length > 0 && (
          <div className="mb-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息…"
            disabled={isGenerating || loadingHistory}
            className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim() || loadingHistory}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isGenerating ? "发送中…" : "发送"}
          </button>
        </form>
      </div>
    </div>
  );
}