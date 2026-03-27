"use client";

/**
 * AgentChat客户端组件
 * 核心聊天逻辑，使用数据库中的Agent配置
 */

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { DbAgentSelector } from "./db-agent-selector";
import { AgentChatSidebar } from "./sidebar";
import { PromptSection } from "./prompt-section";
import { UserMenu } from "@/components/auth/user-menu";
import { getAnonId } from "@/lib/anon-id";
import type { Conversation as ConversationType } from "@/lib/db/schema";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquareIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dbMessageToUIMessage, isToolPart, isStepStartPart } from "@/lib/agent-chat";

/**
 * AgentChatClient 组件的 Props
 */
interface AgentChatClientProps {
  id: string;
}

/**
 * AgentChat客户端组件
 */
export function AgentChatClient({ id }: AgentChatClientProps) {
  const router = useRouter();

  // 移动端侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 对话列表
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  // 加载状态
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // 当前选中的Agent ID
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const agentIdRef = useRef<string>(selectedAgentId);

  // 更新ref
  useEffect(() => {
    agentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  // 创建transport
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/agent-chat",
      headers: () => ({
        "X-User-Id": getAnonId() || "",
      }),
      body: () => ({
        conversationId: id,
        agentId: agentIdRef.current,
      }),
    });
  }, [id]);

  // useChat hook
  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport,
    id: id,
  });

  // URL更新标记
  const hasUpdatedUrl = useRef(false);

  // 监听浏览器前进/后退
  useEffect(() => {
    const handlePopState = () => {
      router.refresh();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // 获取Agent对话列表
  const fetchConversations = useCallback(async () => {
    const anonId = getAnonId();
    if (!anonId) return;

    setIsLoadingConversations(true);
    try {
      const response = await fetch("/api/agent-conversations", {
        headers: { "X-User-Id": anonId },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        return data.conversations || [];
      }
    } catch (error) {
      console.error("获取Agent对话列表失败:", error);
    } finally {
      setIsLoadingConversations(false);
    }
    return [];
  }, []);

  // 初始加载
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 获取已有对话的消息
  useEffect(() => {
    const anonId = getAnonId();
    if (!anonId || window.location.pathname === "/agent-chat") {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          headers: { "X-User-Id": anonId },
        });

        if (response.ok) {
          const data = await response.json();
          const uiMessages = (data.messages || []).map(dbMessageToUIMessage);
          setMessages(uiMessages);

          // 设置Agent ID
          if (data.conversation?.agent_id) {
            setSelectedAgentId(data.conversation.agent_id);
          }
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error("获取消息失败:", error);
        setMessages([]);
      }
    };

    fetchMessages();
  }, [id, setMessages]);

  // 新建对话
  const handleNewChat = useCallback(() => {
    setSidebarOpen(false);
    setSelectedAgentId("");
    router.push("/agent-chat");
  }, [router]);

  // 选择对话
  const handleSelectConversation = useCallback((conversationId: string) => {
    setSidebarOpen(false);
    router.push(`/agent-chat/${conversationId}`);
  }, [router]);

  // 删除对话
  const handleDeleteConversation = useCallback(async (deleteId: string) => {
    const anonId = getAnonId();
    if (!anonId) return;

    try {
      const response = await fetch(`/api/conversations/${deleteId}`, {
        headers: { "X-User-Id": anonId },
        method: "DELETE",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deleteId));
        if (id === deleteId) {
          router.push("/agent-chat");
        }
      }
    } catch (error) {
      console.error("删除对话失败:", error);
    }
  }, [id, router]);

  // 重命名对话
  const handleRenameConversation = useCallback(async (renameId: string, newTitle: string) => {
    const anonId = getAnonId();
    if (!anonId) return;

    try {
      const response = await fetch(`/api/conversations/${renameId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": anonId,
        },
        body: JSON.stringify({ title: newTitle }),
        method: "PATCH",
      });

      if (response.ok) {
        const data = await response.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === renameId ? { ...c, title: data.conversation.title } : c
          )
        );
      }
    } catch (error) {
      console.error("重命名对话失败:", error);
    }
  }, []);

  // 发送消息
  const handleSubmit = useCallback(async (message: { text: string }) => {
    // 验证Agent已选择
    if (!agentIdRef.current) {
      alert("请先选择一个Agent");
      return;
    }

    await sendMessage({ text: message.text });

    setTimeout(async () => {
      await fetchConversations();

      if (!hasUpdatedUrl.current && window.location.pathname === "/agent-chat") {
        hasUpdatedUrl.current = true;
        window.history.pushState({}, "", `/agent-chat/${id}`);
      }
    }, 1000);
  }, [sendMessage, fetchConversations, id]);

  // 当前对话
  const currentConversation = conversations.find((c) => c.id === id);

  // 是否正在生成
  const isGenerating = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-screen">
      {/* 左侧边栏 */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transform overflow-hidden border-r border-border bg-background
          transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <AgentChatSidebar
          conversations={conversations}
          currentConversationId={id}
          isLoading={isLoadingConversations}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
        />
      </aside>

      {/* 移动端遮罩层 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 右侧对话区 */}
      <main className="flex min-w-0 flex-1 flex-col h-full">
        {/* 头部 */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-4">
            <button
              className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">
                {currentConversation?.title || "Agent对话"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {currentConversation ? "继续对话..." : "选择Agent开始对话"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DbAgentSelector
              onChange={setSelectedAgentId}
              value={selectedAgentId}
              disabled={currentConversation !== undefined}
            />
            <UserMenu />
          </div>
        </header>

        {/* 消息区域 */}
        <div className="flex-1 overflow-hidden">
          <Conversation className="h-full">
            <ConversationContent className="px-6 py-6">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent className="max-w-3xl">
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          return <MessageResponse key={index}>{part.text}</MessageResponse>;
                        }
                        if (isToolPart(part)) {
                          const toolPart = part as ToolPart;
                          const defaultOpen = toolPart.state === "output-available" || toolPart.state === "output-error";
                          const isDynamicTool = toolPart.type === "dynamic-tool";
                          const dynamicPart = toolPart as { toolName?: string };

                          return (
                            <Tool key={index} defaultOpen={defaultOpen}>
                              {isDynamicTool ? (
                                <ToolHeader
                                  type="dynamic-tool"
                                  state={toolPart.state}
                                  toolName={dynamicPart.toolName || "unknown"}
                                />
                              ) : (
                                <ToolHeader
                                  type={toolPart.type as `tool-${string}`}
                                  state={toolPart.state}
                                />
                              )}
                              <ToolContent>
                                <ToolInput input={toolPart.input} />
                                <ToolOutput
                                  output={toolPart.output}
                                  errorText={toolPart.errorText}
                                />
                              </ToolContent>
                            </Tool>
                          );
                        }
                        if (isStepStartPart(part)) {
                          return (
                            <div key={index} className="flex items-center gap-2 my-2">
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))
              ) : (
                <ConversationEmptyState
                  description="选择一个Agent开始对话"
                  icon={<MessageSquareIcon className="w-10 h-10" />}
                  title="Agent对话"
                  className="mt-16"
                />
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* 输入区域 */}
        <div className="px-6 py-6">
          <PromptSection
            onSubmit={handleSubmit}
            onStop={stop}
            status={isGenerating ? "streaming" : "ready"}
            placeholder="输入消息，按 Enter 发送..."
          />
        </div>
      </main>
    </div>
  );
}