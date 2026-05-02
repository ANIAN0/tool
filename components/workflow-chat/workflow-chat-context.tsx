"use client";

/**
 * WorkflowChat Context
 * 管理 Workflow 聊天的全局状态
 */

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowChatConversation } from "@/lib/schemas/workflowchat";
import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";

const NEW_CHAT_PATH = "/workflowchat";

export interface WorkflowChatMessageMetadata {
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  contextLimit: number;
  modelName: string;
}

interface WorkflowChatState {
  conversations: WorkflowChatConversation[];
  currentConversationId: string;
  currentConversation: WorkflowChatConversation | undefined;
  messages: UIMessage[];
  isLoadingConversations: boolean;
  isGenerating: boolean;
  status: import("ai").ChatStatus;
  selectedAgentId: string;
  lastAssistantMetadata: WorkflowChatMessageMetadata | undefined;
  sidebarOpen: boolean;
  error: Error | undefined;
}

interface WorkflowChatActions {
  fetchConversations: () => Promise<WorkflowChatConversation[]>;
  handleNewChat: () => void;
  handleSelectConversation: (conversationId: string) => void;
  handleDeleteConversation: (deleteId: string) => Promise<void>;
  handleRenameConversation: (renameId: string, newTitle: string) => Promise<void>;
  handleSubmit: (message: { text: string }) => Promise<void>;
  handleDeleteClick: (messageId: string) => void;
  handleConfirmDelete: () => Promise<void>;
  closeDeleteDialog: () => void;
  handleEditClick: (messageId: string) => void;
  handleConfirmEdit: () => Promise<void>;
  closeEditDialog: () => void;
  stop: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedAgentId: (agentId: string) => void;
  reload: () => void;
}

interface WorkflowChatMeta {
  latestCheckpointIndex: number;
  prefillInput: string;
  inputKey: number;
  deleteDialogOpen: boolean;
  editDialogOpen: boolean;
  isDeleting: boolean;
  isEditing: boolean;
  messageToDelete: string | null;
  messageToEdit: string | null;
  editContent: string;
}

interface WorkflowChatContextValue {
  state: WorkflowChatState;
  actions: WorkflowChatActions;
  meta: WorkflowChatMeta;
}

const WorkflowChatContext = createContext<WorkflowChatContextValue | null>(null);

export function useWorkflowChatContext() {
  const context = use(WorkflowChatContext);
  if (!context) {
    throw new Error("WorkflowChat components must be used within WorkflowChatProvider");
  }
  return context;
}

export { WorkflowChatContext };
export type {
  WorkflowChatState,
  WorkflowChatActions,
  WorkflowChatMeta,
  WorkflowChatContextValue
};

interface WorkflowChatProviderProps {
  conversationId: string;
  children: React.ReactNode;
}

export function WorkflowChatProvider({ conversationId, children }: WorkflowChatProviderProps) {
  const router = useRouter();
  const { authenticatedFetch } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<WorkflowChatConversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const agentIdRef = useRef<string>(selectedAgentId);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [messageToEdit, setMessageToEdit] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [prefillInput, setPrefillInput] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const hasUpdatedUrl = useRef(false);

  useEffect(() => {
    agentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  // 配置消息发送的 transport
  // API 路径：POST /api/workflowchat/conversations/:id/messages
  // 请求体：{ agentId: string, content: string, modelId?: string }
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: `/api/workflowchat/conversations/${conversationId}/messages`,
      prepareSendMessagesRequest({ messages, headers: baseHeaders }) {
        // 获取最后一条用户消息
        const lastMessage = messages[messages.length - 1];
        // 从消息中提取文本内容
        const textContent = lastMessage.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("\n");

        const accessToken =
          typeof window !== "undefined"
            ? localStorage.getItem("accessToken")
            : null;

        return {
          headers: {
            ...baseHeaders,
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {}),
          },
          body: {
            agentId: agentIdRef.current,
            content: textContent,
          },
        };
      },
    });
  }, [conversationId]);

  const { messages, sendMessage, status, stop, setMessages, error, reload } = useChat({
    transport,
    id: conversationId,
    onFinish: ({ finishReason, isAbort }) => {
      if (finishReason === "error" || isAbort) return;
      fetchConversations();
      if (!hasUpdatedUrl.current && window.location.pathname === NEW_CHAT_PATH) {
        hasUpdatedUrl.current = true;
        window.history.pushState({}, "", `/workflowchat/${conversationId}`);
      }
    },
    onError: (error) => {
      console.error("[workflow-chat] 发送消息失败:", error);
    },
  });

  useEffect(() => {
    const handlePopState = () => {
      router.refresh();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const response = await authenticatedFetch("/api/workflowchat/conversations");

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        return data.conversations || [];
      }
    } catch (error) {
      console.error("获取 Workflow 会话列表失败:", error);
    } finally {
      setIsLoadingConversations(false);
    }
    return [];
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (window.location.pathname === NEW_CHAT_PATH) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const response = await authenticatedFetch(`/api/workflowchat/conversations/${conversationId}`);

        if (response.ok) {
          const data = await response.json();
          const metadataContext = data.metadataContext;
          const uiMessages = (data.messages || []).map((msg: any) =>
            dbMessageToUIMessage(msg, metadataContext)
          );
          setMessages(uiMessages);

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
  }, [conversationId, setMessages, authenticatedFetch]);

  const handleNewChat = useCallback(() => {
    setSidebarOpen(false);
    setSelectedAgentId("");
    hasUpdatedUrl.current = false;
    router.push(NEW_CHAT_PATH);
  }, [router]);

  const handleSelectConversation = useCallback((targetId: string) => {
    setSidebarOpen(false);
    hasUpdatedUrl.current = false;
    router.push(`/workflowchat/${targetId}`);
  }, [router]);

  const handleDeleteConversation = useCallback(async (deleteId: string) => {
    try {
      const response = await authenticatedFetch(`/api/workflowchat/conversations/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deleteId));
        if (conversationId === deleteId) {
          router.push(NEW_CHAT_PATH);
        }
      }
    } catch (error) {
      console.error("删除会话失败:", error);
    }
  }, [conversationId, router, authenticatedFetch]);

  const handleRenameConversation = useCallback(async (renameId: string, newTitle: string) => {
    try {
      const response = await authenticatedFetch(`/api/workflowchat/conversations/${renameId}`, {
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
      console.error("重命名会话失败:", error);
    }
  }, [authenticatedFetch]);

  const handleDeleteClick = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!messageToDelete) return;

    setIsDeleting(true);
    try {
      const response = await authenticatedFetch(
        `/api/workflowchat/conversations/${conversationId}/messages/${messageToDelete}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除失败");
      }

      await fetchConversations();
      setMessages([]);
      router.refresh();
    } catch (error) {
      console.error("删除消息失败:", error);
      alert(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  }, [messageToDelete, authenticatedFetch, conversationId, fetchConversations, router]);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  }, []);

  const handleEditClick = useCallback((messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const textContent = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("\n");

    setMessageToEdit(messageId);
    setEditContent(textContent);
    setEditDialogOpen(true);
  }, [messages]);

  const handleConfirmEdit = useCallback(async () => {
    if (!messageToEdit || !editContent.trim()) return;

    setIsEditing(true);
    try {
      const response = await authenticatedFetch(
        `/api/workflowchat/conversations/${conversationId}/messages/${messageToEdit}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除失败");
      }

      await fetchConversations();
      setMessages([]);
      setPrefillInput(editContent);
      setInputKey((prev) => prev + 1);
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
  }, [messageToEdit, editContent, authenticatedFetch, conversationId, fetchConversations, router]);

  const closeEditDialog = useCallback(() => {
    setEditDialogOpen(false);
    setMessageToEdit(null);
    setEditContent("");
  }, []);

  const handleSubmit = useCallback(async (message: { text: string }) => {
    if (!agentIdRef.current) {
      alert("请先选择一个 Agent");
      return;
    }

    await sendMessage({ text: message.text });
  }, [sendMessage]);

  const currentConversation = conversations.find((c) => c.id === conversationId);
  const isGenerating = status === "submitted" || status === "streaming";

  const lastAssistantMetadata = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return messages[i].metadata as WorkflowChatMessageMetadata | undefined;
      }
    }
    return undefined;
  }, [messages]);

  const state: WorkflowChatState = {
    conversations,
    currentConversationId: conversationId,
    currentConversation,
    messages,
    isLoadingConversations,
    isGenerating,
    status,
    selectedAgentId,
    lastAssistantMetadata,
    sidebarOpen,
    error,
  };

  const actions: WorkflowChatActions = {
    fetchConversations,
    handleNewChat,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
    handleSubmit,
    handleDeleteClick,
    handleConfirmDelete,
    closeDeleteDialog,
    handleEditClick,
    handleConfirmEdit,
    closeEditDialog,
    stop,
    setSidebarOpen,
    setSelectedAgentId,
    reload,
  };

  const meta: WorkflowChatMeta = {
    latestCheckpointIndex: -1,
    prefillInput,
    inputKey,
    deleteDialogOpen,
    editDialogOpen,
    isDeleting,
    isEditing,
    messageToDelete,
    messageToEdit,
    editContent,
  };

  const contextValue: WorkflowChatContextValue = {
    state,
    actions,
    meta,
  };

  return (
    <WorkflowChatContext.Provider value={contextValue}>
      {children}
    </WorkflowChatContext.Provider>
  );
}

function dbMessageToUIMessage(
  msg: any,
  metadata?: { contextLimit: number; modelName: string }
): UIMessage {
  try {
    const parsed = JSON.parse(msg.parts);
    if (parsed && typeof parsed === "object" && "id" in parsed && "role" in parsed && "parts" in parsed) {
      if (msg.role === "assistant" && metadata && (msg.input_tokens || msg.output_tokens || msg.total_tokens)) {
        return {
          ...parsed,
          metadata: {
            usage: {
              inputTokens: msg.input_tokens ?? undefined,
              outputTokens: msg.output_tokens ?? undefined,
              totalTokens: msg.total_tokens ?? undefined,
            },
            contextLimit: metadata.contextLimit,
            modelName: metadata.modelName,
          },
        };
      }
      return parsed as UIMessage;
    }
  } catch {}

  return {
    id: msg.id,
    role: msg.role,
    parts: [{ type: "text", text: typeof msg.parts === "string" ? msg.parts : JSON.stringify(msg.parts) }],
  };
}