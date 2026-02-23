"use client";

/**
 * 聊天客户端组件
 * 核心聊天逻辑，接收对话ID作为参数
 * 使用 key 属性控制组件重置，避免整页刷新
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
import { ModelSelector, DEFAULT_MODEL_ID } from "@/components/chat/model-selector";
import { AgentSelector } from "@/components/chat/agent-selector";
import { PromptSection } from "@/components/chat/prompt-section";
import { Sidebar } from "@/components/chat/sidebar";
import { UserMenu } from "@/components/auth/user-menu";
import { getAnonId } from "@/lib/anon-id";
import type { Conversation as ConversationType, Message as DBMessage } from "@/lib/db/schema";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { MessageSquareIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_AGENT_ID, getAgentConfig } from "@/lib/agents/config";

/**
 * 检查是否是工具调用的 part
 */
function isToolPart(part: { type: string }): part is ToolPart {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

/**
 * 检查是否是步骤开始的 part
 */
function isStepStartPart(part: { type: string }): boolean {
  return part.type === "step-start";
}

/**
 * 将数据库消息转换为UIMessage格式
 */
function dbMessageToUIMessage(msg: DBMessage): UIMessage {
  try {
    const parsed = JSON.parse(msg.content);
    if (parsed && typeof parsed === "object" && "id" in parsed && "role" in parsed && "parts" in parsed && Array.isArray(parsed.parts)) {
      return parsed as UIMessage;
    }
  } catch {
    // 解析失败，说明是纯文本格式
  }
  
  return {
    id: msg.id,
    role: msg.role,
    parts: [{ type: "text", text: msg.content }],
  };
}

/**
 * ChatClient 组件的 Props
 */
interface ChatClientProps {
  // 对话ID（新对话时为预生成的ID，已有对话时为URL中的ID）
  id: string;
}

/**
 * 聊天客户端组件
 */
export function ChatClient({ id }: ChatClientProps) {
  const router = useRouter();
  
  // 移动端侧边栏显示状态
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 对话列表
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  // 对话列表加载状态
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // 当前选中的模型ID
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);
  // 当前选中的Agent ID
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENT_ID);

  // 使用ref存储最新的agentId，确保每次请求都使用最新值
  const agentIdRef = useRef<string>(selectedAgentId);

  // 当selectedAgentId变化时更新ref
  useEffect(() => {
    agentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  // 使用 useMemo 创建 transport
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      headers: () => ({
        "X-User-Id": getAnonId() || "",
      }),
      body: () => {
        return {
          conversationId: id,
          model: selectedModelId,
          agentId: agentIdRef.current,
        };
      },
    });
  }, [id, selectedModelId]);

  // 使用 useChat hook 管理聊天状态
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

  // 是否已经更新过URL（用于控制首条消息后的URL更新）
  const hasUpdatedUrl = useRef(false);

  // 监听浏览器前进/后退，刷新服务端组件以同步URL
  useEffect(() => {
    const handlePopState = () => {
      // 用户前进/后退时，刷新页面以同步URL和组件状态
      router.refresh();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // 获取对话列表
  const fetchConversations = useCallback(async () => {
    const anonId = getAnonId();
    if (!anonId) return;

    setIsLoadingConversations(true);
    try {
      const response = await fetch("/api/conversations", {
        headers: {
          "X-User-Id": anonId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        return data.conversations || [];
      }
    } catch (error) {
      console.error("获取对话列表失败:", error);
    } finally {
      setIsLoadingConversations(false);
    }
    return [];
  }, []);

  // 初始加载对话列表
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 获取对话消息（仅在已有对话页面 /chat/[id] 时）
  // 新对话页面 /chat 不从数据库加载消息
  useEffect(() => {
    const anonId = getAnonId();
    // 新对话页面不从数据库加载消息
    if (!anonId || window.location.pathname === "/chat") {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          headers: {
            "X-User-Id": anonId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const uiMessages = (data.messages || []).map(dbMessageToUIMessage);
          setMessages(uiMessages);
          
          // 更新选中的Agent ID到该对话关联的Agent
          if (data.conversation?.agent_id) {
            setSelectedAgentId(data.conversation.agent_id);
          }
        } else {
          // 对话不存在（可能是无效ID），清空消息
          setMessages([]);
        }
      } catch (error) {
        console.error("获取消息失败:", error);
        setMessages([]);
      }
    };

    fetchMessages();
  }, [id, setMessages]);

  // 新建对话 - 使用路由跳转，不刷新页面
  const handleNewChat = useCallback(() => {
    setSidebarOpen(false);
    router.push("/chat");
  }, [router]);

  // 选择对话 - 使用路由跳转
  const handleSelectConversation = useCallback((conversationId: string) => {
    setSidebarOpen(false);
    router.push(`/chat/${conversationId}`);
  }, [router]);

  // 删除对话
  const handleDeleteConversation = useCallback(async (deleteId: string) => {
    const anonId = getAnonId();
    if (!anonId) return;

    try {
      const response = await fetch(`/api/conversations/${deleteId}`, {
        headers: {
          "X-User-Id": anonId,
        },
        method: "DELETE",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deleteId));

        // 如果删除的是当前对话，跳转到新对话页面
        if (id === deleteId) {
          router.push("/chat");
        }
      } else {
        console.error("删除对话失败");
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
      } else {
        console.error("重命名对话失败");
      }
    } catch (error) {
      console.error("重命名对话失败:", error);
    }
  }, []);

  // 发送消息
  const handleSubmit = useCallback(async (message: { text: string }) => {
    // 发送消息
    await sendMessage({ text: message.text });

    // 刷新对话列表
    setTimeout(async () => {
      await fetchConversations();
      
      // 如果是新对话页面（URL 是 /chat），发送首条消息后更新 URL
      // 使用 pushState 更新 URL，不触发页面刷新
      if (!hasUpdatedUrl.current && window.location.pathname === "/chat") {
        hasUpdatedUrl.current = true;
        window.history.pushState({}, "", `/chat/${id}`);
      }
    }, 1000);
  }, [sendMessage, fetchConversations, id]);

  // 获取当前对话信息
  const currentConversation = conversations.find(
    (c) => c.id === id
  );

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
        <Sidebar
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
        {/* 对话区头部 */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-4">
            <button
              className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">
                {currentConversation?.title || "AI 对话助手"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {currentConversation ? "继续对话..." : "开始新对话"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AgentSelector
              onChange={setSelectedAgentId}
              value={selectedAgentId}
              disabled={currentConversation !== undefined}
            />
            <ModelSelector
              onChange={setSelectedModelId}
              value={selectedModelId}
            />
            {/* 用户菜单 */}
            <UserMenu />
          </div>
        </header>

        {/* 消息显示区域 */}
        <div className="flex-1 overflow-hidden">
          <Conversation className="h-full">
            <ConversationContent className="px-6 py-6">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent className="max-w-3xl">
                      {message.parts.map((part, index) => {
                        // 文本内容
                        if (part.type === "text") {
                          return <MessageResponse key={index}>{part.text}</MessageResponse>;
                        }
                        // 工具调用
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
                        // 步骤分隔线
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
                  description="选择一个对话或创建新对话开始聊天"
                  icon={<MessageSquareIcon className="w-10 h-10" />}
                  title="开始对话"
                  className="mt-16"
                />
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* 消息输入区域 */}
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
