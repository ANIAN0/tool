"use client";

/**
 * 对话页面主体
 * 左右分栏布局：左侧历史列表 + 右侧对话区
 * 包含对话状态管理
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
import { ModelSelector, DEFAULT_MODEL_ID } from "@/components/chat/model-selector";
import { PromptSection } from "@/components/chat/prompt-section";
import { Sidebar } from "@/components/chat/sidebar";
import { getAnonId } from "@/lib/anon-id";
import type { Conversation as ConversationType, Message as DBMessage } from "@/lib/db/schema";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { MessageSquareIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * 将数据库消息转换为UIMessage格式
 */
function dbMessageToUIMessage(msg: DBMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: [{ type: "text", text: msg.content }],
  };
}

/**
 * 对话页面
 * 功能点12：对话页面布局
 * 功能点13：左侧对话列表组件集成
 * 功能点14：删除和重命名对话功能
 * 功能点15：对话消息区域组件集成
 * 功能点17：消息输入组件集成
 * 功能点18：模型选择器组件集成
 * 功能点23：发送消息并流式接收回复
 */
export default function ChatPage() {
  // 移动端侧边栏显示状态
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 对话列表
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  // 对话列表加载状态
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  // 当前选中的对话ID
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  // 消息加载状态
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  // 当前选中的模型ID
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);

  // 使用 useMemo 创建 transport，确保 headers 和 body 是最新的
  // 注意：headers 函数在每次请求时调用，直接读取最新状态
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      // 使用函数形式确保获取最新值
      // 直接调用 getAnonId() 而不是依赖 state，避免首次渲染时为空
      headers: () => ({
        "X-User-Id": getAnonId() || "",
      }),
      body: () => ({
        conversationId: currentConversationId,
        model: selectedModelId,
      }),
    });
  }, [currentConversationId, selectedModelId]);

  // 使用 useChat hook 管理聊天状态
  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport,
    // 对话ID变化时重置消息
    id: currentConversationId || "new-chat",
  });

  // 获取对话列表 - 直接使用 getAnonId()，避免依赖 state
  useEffect(() => {
    const id = getAnonId();
    if (!id) return;

    const fetchConversations = async () => {
      setIsLoadingConversations(true);
      try {
        const response = await fetch("/api/conversations", {
          headers: {
            "X-User-Id": id,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setConversations(data.conversations || []);
        }
      } catch (error) {
        console.error("获取对话列表失败:", error);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    fetchConversations();
  }, []);

  // 获取对话消息（功能点20：加载历史对话）
  useEffect(() => {
    const id = getAnonId();
    if (!id || !currentConversationId) {
      // 清空消息
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const response = await fetch(`/api/conversations/${currentConversationId}`, {
          headers: {
            "X-User-Id": id,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // 将数据库消息转换为UIMessage格式
          const uiMessages = (data.messages || []).map(dbMessageToUIMessage);
          setMessages(uiMessages);
        } else {
          console.error("获取消息失败");
          setMessages([]);
        }
      } catch (error) {
        console.error("获取消息失败:", error);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [currentConversationId, setMessages]);

  // 刷新对话列表（发送消息后调用）
  // 直接使用 getAnonId() 获取用户ID，避免依赖 state
  // 修复多轮对话问题：如果是新对话，刷新后自动选中新创建的对话
  const refreshConversations = useCallback(async () => {
    const id = getAnonId();
    if (!id) return;

    // 记录刷新前是否没有选中的对话（即新对话状态）
    const wasNewChat = !currentConversationId;

    try {
      const response = await fetch("/api/conversations", {
        headers: {
          "X-User-Id": id,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newConversations = data.conversations || [];
        setConversations(newConversations);

        // 如果之前是新对话状态，自动选中最新创建的对话
        // 这样后续的消息都会在这个对话中，不会创建新对话记录
        if (wasNewChat && newConversations.length > 0) {
          // 按时间倒序排列，第一个是最新的
          const latestConversation = newConversations[0];
          setCurrentConversationId(latestConversation.id);
        }
      }
    } catch (error) {
      console.error("刷新对话列表失败:", error);
    }
    // 依赖 currentConversationId 以便正确检测新对话状态
  }, [currentConversationId]);

  // 新建对话（功能点19：方案2 - 延迟创建）
  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  // 选择对话
  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setSidebarOpen(false);
  };

  // 删除对话
  const handleDeleteConversation = async (id: string) => {
    const anonId = getAnonId();
    if (!anonId) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        headers: {
          "X-User-Id": anonId,
        },
        method: "DELETE",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));

        if (currentConversationId === id) {
          const remainingConversations = conversations.filter((c) => c.id !== id);
          setCurrentConversationId(
            remainingConversations.length > 0 ? remainingConversations[0].id : null
          );
        }
      } else {
        console.error("删除对话失败");
      }
    } catch (error) {
      console.error("删除对话失败:", error);
    }
  };

  // 重命名对话
  const handleRenameConversation = async (id: string, newTitle: string) => {
    const anonId = getAnonId();
    if (!anonId) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
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
            c.id === id ? { ...c, title: data.conversation.title } : c
          )
        );
      } else {
        console.error("重命名对话失败");
      }
    } catch (error) {
      console.error("重命名对话失败:", error);
    }
  };

  // 发送消息（功能点23）
  // 注意：userId 检查已移除，因为 transport 的 headers 会直接调用 getAnonId()
  const handleSubmit = useCallback(async (message: { text: string }) => {
    // 发送消息
    await sendMessage({ text: message.text });

    // 延迟刷新对话列表（等待后端创建对话）
    setTimeout(() => {
      refreshConversations();
    }, 1000);
  }, [sendMessage, refreshConversations]);

  // 获取当前对话信息
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  // 是否正在生成
  const isGenerating = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-screen">
      {/* 左侧边栏 */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-background
          transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
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
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <button
            className="mr-2 rounded-md p-2 hover:bg-muted md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <svg
              className="size-5"
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
            <h1 className="font-medium text-sm">
              {currentConversation?.title || "AI 对话助手"}
            </h1>
          </div>

          <ModelSelector
            onChange={setSelectedModelId}
            value={selectedModelId}
          />
        </header>

        {/* 消息显示区域 - 需要外层容器限制高度并显示滚动条 */}
        <div className="flex-1 overflow-hidden">
          <Conversation className="h-full">
            {messages.length > 0 ? (
              <ConversationContent>
                {messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          return <MessageResponse key={index}>{part.text}</MessageResponse>;
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))}
              </ConversationContent>
            ) : (
              <ConversationEmptyState
                description="选择一个对话或创建新对话开始聊天"
                icon={<MessageSquareIcon className="size-10" />}
                title="开始对话"
              />
            )}
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* 消息输入区域 */}
        <PromptSection
          onSubmit={handleSubmit}
          onStop={stop}
          status={isGenerating ? "streaming" : "ready"}
          placeholder="输入消息，按 Enter 发送..."
        />
      </main>
    </div>
  );
}
