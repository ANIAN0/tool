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
import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import type { LanguageModelUsage } from "ai";
import { DbAgentSelector } from "./db-agent-selector";
import { AgentChatSidebar } from "./sidebar";
import { PromptSection } from "./prompt-section";
import { MessageActions, type MessageMetadata } from "./message-actions";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Conversation as ConversationType } from "@/lib/db/schema";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquareIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dbMessageToUIMessage, isToolPart, isStepStartPart, isCheckpointPart, getCheckpointInfo } from "@/lib/agent-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  // 获取认证状态和认证头方法
  const { getAuthHeader, authenticatedFetch } = useAuth();

  // 移动端侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 对话列表
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  // 加载状态
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // 当前选中的Agent ID
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const agentIdRef = useRef<string>(selectedAgentId);

  // ==================== 消息撤回相关状态 ====================
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // 要删除的消息ID
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  // 删除中状态
  const [isDeleting, setIsDeleting] = useState(false);

  // ==================== 消息编辑相关状态 ====================
  // 编辑对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // 要编辑的消息ID
  const [messageToEdit, setMessageToEdit] = useState<string | null>(null);
  // 编辑中的消息内容
  const [editContent, setEditContent] = useState("");
  // 编辑提交中状态
  const [isEditing, setIsEditing] = useState(false);

  // 更新ref
  useEffect(() => {
    agentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  // 创建transport - 使用 prepareSendMessagesRequest 只发送最后一条消息
  // 符合 AI SDK 最佳实践，避免前端发送完整消息列表导致重复
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/agent-chat",
      headers: getAuthHeader,
      // 使用 prepareSendMessagesRequest 只发送最后一条消息
      prepareSendMessagesRequest({ messages, id: chatId }) {
        return {
          body: {
            message: messages[messages.length - 1],  // 只发送最后一条消息
            conversationId: chatId,                   // AI SDK 传入的对话 ID
            agentId: agentIdRef.current,
          },
        };
      },
    });
  }, [id, getAuthHeader]);

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
    setIsLoadingConversations(true);
    try {
      // 使用 authenticatedFetch 支持自动刷新 token
      const response = await authenticatedFetch("/api/agent-conversations");

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
  }, [authenticatedFetch]);

  // 初始加载
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 获取已有对话的消息
  useEffect(() => {
    if (window.location.pathname === "/agent-chat") {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        // 使用 authenticatedFetch 支持自动刷新 token
        const response = await authenticatedFetch(`/api/conversations/${id}`);

        if (response.ok) {
          const data = await response.json();
          // 使用 API 返回的 metadataContext（包含 contextLimit 和 modelName）
          // 用于历史消息显示 Context 组件的 token 用量
          const metadataContext = data.metadataContext;
          const uiMessages = (data.messages || []).map((msg: any) =>
            dbMessageToUIMessage(msg, metadataContext)
          );
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
  }, [id, setMessages, authenticatedFetch]);

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
    try {
      // 使用 authenticatedFetch 支持自动刷新 token
      const response = await authenticatedFetch(`/api/conversations/${deleteId}`, {
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
  }, [id, router, authenticatedFetch]);

  // 重命名对话
  const handleRenameConversation = useCallback(async (renameId: string, newTitle: string) => {
    try {
      // 使用 authenticatedFetch 支持自动刷新 token
      const response = await authenticatedFetch(`/api/conversations/${renameId}`, {
        headers: {
          "Content-Type": "application/json",
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
  }, [authenticatedFetch]);

  // ==================== 消息撤回功能 ====================

  /**
   * 打开删除确认对话框
   */
  const handleDeleteClick = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * 确认删除消息
   * 级联删除该消息及之后的所有消息
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!messageToDelete) return;

    setIsDeleting(true);
    try {
      const response = await authenticatedFetch(
        `/api/messages/${messageToDelete}/delete`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除失败");
      }

      // 刷新对话列表和消息
      await fetchConversations();

      // 重新加载消息（从本地状态移除被删除的消息）
      // 由于删除是级联的，需要重新获取消息
      router.refresh();
    } catch (error) {
      console.error("删除消息失败:", error);
      alert(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  }, [messageToDelete, authenticatedFetch, fetchConversations, router]);

  // ==================== 消息编辑功能 ====================

  /**
   * 打开编辑对话框
   */
  const handleEditClick = useCallback((messageId: string) => {
    // 找到消息内容
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    // 提取文本内容
    const textContent = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("\n");

    setMessageToEdit(messageId);
    setEditContent(textContent);
    setEditDialogOpen(true);
  }, [messages]);

  /**
   * 确认编辑消息
   * 调用 edit-regenerate API，编辑消息并重新生成回复
   */
  const handleConfirmEdit = useCallback(async () => {
    if (!messageToEdit || !editContent.trim()) return;

    setIsEditing(true);
    try {
      const response = await authenticatedFetch(
        `/api/messages/${messageToEdit}/edit-regenerate`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: [{ type: "text", text: editContent.trim() }],
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "编辑失败");
      }

      // 刷新对话列表和消息
      await fetchConversations();
      router.refresh();
    } catch (error) {
      console.error("编辑消息失败:", error);
      alert(error instanceof Error ? error.message : "编辑失败");
    } finally {
      setIsEditing(false);
      setEditDialogOpen(false);
      setMessageToEdit(null);
      setEditContent("");
    }
  }, [messageToEdit, editContent, authenticatedFetch, fetchConversations, router]);

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

  // 获取最后一条 assistant 消息的元数据（用于 Context 组件）
  const lastAssistantMetadata = useMemo(() => {
    // 反向查找最后一条 assistant 消息
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return messages[i].metadata as MessageMetadata | undefined;
      }
    }
    return undefined;
  }, [messages]);

  // 找到最新 checkpoint 的索引位置（用于判断消息是否可以删除）
  const latestCheckpointIndex = useMemo(() => {
    // 反向查找最新的 checkpoint
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].parts.some((p) => isCheckpointPart(p))) {
        return i;
      }
    }
    return -1; // 没有 checkpoint
  }, [messages]);

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
            {/* Context 组件：显示会话累计 token 使用情况 */}
            {currentConversation && currentConversation.total_tokens > 0 && lastAssistantMetadata && (
              <Context
                maxTokens={lastAssistantMetadata.contextLimit}
                usedTokens={currentConversation.total_input_tokens}
                usage={{
                  // 使用数据库累计值
                  inputTokens: currentConversation.total_input_tokens,
                  outputTokens: currentConversation.total_output_tokens,
                  totalTokens: currentConversation.total_tokens,
                  // 缓存和推理 token 从最后一条消息获取（累计值数据库未存储）
                  cachedInputTokens: lastAssistantMetadata.usage.inputTokenDetails?.cacheReadTokens,
                  reasoningTokens: lastAssistantMetadata.usage.outputTokenDetails?.reasoningTokens,
                  inputTokenDetails: lastAssistantMetadata.usage.inputTokenDetails,
                  outputTokenDetails: lastAssistantMetadata.usage.outputTokenDetails,
                }}
                modelId={lastAssistantMetadata.modelName}
              >
                <ContextTrigger />
                <ContextContent>
                  <ContextContentHeader />
                  <ContextContentBody>
                    <ContextInputUsage />
                    <ContextOutputUsage />
                  </ContextContentBody>
                </ContextContent>
              </Context>
            )}
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
                messages.map((message, index) => {
                  // 检查是否是 checkpoint 消息
                  const checkpointPart = message.parts.find((p) => isCheckpointPart(p));

                  // 只渲染最新的 checkpoint，旧的 checkpoint 跳过
                  if (checkpointPart && index === latestCheckpointIndex) {
                    const checkpointInfo = getCheckpointInfo(checkpointPart);
                    if (checkpointInfo) {
                      return (
                        <div key={message.id} className="flex items-center gap-2 my-4 py-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            已压缩 {checkpointInfo.removedCount} 条历史消息
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      );
                    }
                  }

                  // 跳过旧的 checkpoint（不渲染）
                  if (checkpointPart) {
                    return null;
                  }

                  // 获取当前消息的元数据
                  const messageMetadata = message.metadata as MessageMetadata | undefined;
                  // 判断是否可以删除：checkpoint 之前的消息不能删除
                  const canDelete = latestCheckpointIndex === -1 || index > latestCheckpointIndex;

                  return (
                    <div key={message.id} className="group relative mb-4">
                      <Message from={message.role}>
                        <MessageContent className="max-w-3xl">
                          {message.parts.map((part, partIndex) => {
                            if (part.type === "text") {
                              return <MessageResponse key={partIndex}>{part.text}</MessageResponse>;
                            }
                            if (isToolPart(part)) {
                              const toolPart = part as ToolPart;
                              const defaultOpen = toolPart.state === "output-available" || toolPart.state === "output-error";
                              const isDynamicTool = toolPart.type === "dynamic-tool";
                              const dynamicPart = toolPart as { toolName?: string };

                              return (
                                <Tool key={partIndex} defaultOpen={defaultOpen}>
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
                                <div key={partIndex} className="flex items-center gap-2 my-2">
                                  <div className="flex-1 h-px bg-border" />
                                </div>
                              );
                            }
                            return null;
                          })}
                        </MessageContent>
                      </Message>
                      {/* 消息操作栏：token 信息 + 操作按钮 */}
                      <div className="mt-1 ml-2">
                        <MessageActions
                          role={message.role}
                          content={message.parts
                            .filter((p) => p.type === "text")
                            .map((p) => (p as { type: "text"; text: string }).text)
                            .join("\n")}
                          metadata={messageMetadata}
                          isGenerating={isGenerating}
                          onDelete={canDelete ? () => handleDeleteClick(message.id) : undefined}
                          onEdit={message.role === "user" && canDelete ? () => handleEditClick(message.id) : undefined}
                        />
                      </div>
                    </div>
                  );
                })
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

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          // 如果正在删除，禁止关闭对话框（防止状态不一致）
          if (isDeleting && !open) return;
          setDeleteDialogOpen(open);
          // 对话框关闭时清除要删除的消息ID
          if (!open) {
            setMessageToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除此消息将同时删除后续所有消息，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑消息对话框 */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          // 如果正在编辑，禁止关闭对话框（防止状态不一致）
          if (isEditing && !open) return;
          setEditDialogOpen(open);
          // 对话框关闭时清除编辑状态
          if (!open) {
            setMessageToEdit(null);
            setEditContent("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑消息</DialogTitle>
            <DialogDescription>
              编辑消息后将重新生成回复，后续消息将被删除。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="输入消息内容..."
              className="min-h-[120px] resize-none"
              disabled={isEditing}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isEditing}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmEdit}
              disabled={isEditing || !editContent.trim()}
            >
              {isEditing ? "提交中..." : "确认编辑"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}