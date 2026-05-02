"use client";

/**
 * AgentChat Context
 * 管理 Agent 聊天的全局状态
 *
 * 状态分为三层：
 * - state: 核心数据状态（对话列表、消息、加载状态等）
 * - actions: 操作函数（新建对话、选择对话、发送消息等）
 * - meta: 元数据状态（对话框状态、输入框状态等）
 */

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation } from "@/lib/schemas";
import type { MessageMetadata } from "./message-actions";
import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { dbMessageToUIMessage } from "@/lib/agent-chat/utils";

// 路由常量
const NEW_CHAT_PATH = "/agent-chat";

// ==================== 状态接口定义 ====================

/**
 * 核心数据状态
 * 包含对话列表、消息、加载状态等
 */
interface AgentChatState {
  // 对话列表
  conversations: Conversation[];
  // 当前对话 ID（来自 URL 参数）
  currentConversationId: string;
  // 当前对话对象
  currentConversation: Conversation | undefined;
  // 消息列表（来自 useChat）
  messages: UIMessage[];
  // 对话列表加载状态
  isLoadingConversations: boolean;
  // 是否正在生成消息
  isGenerating: boolean;
  // useChat 原始状态（submitted/streaming/ready/error）
  status: import("ai").ChatStatus;
  // 当前选中的 Agent ID
  selectedAgentId: string;
  // Checkpoint 信息（用于消息删除权限判断）
  checkpointInfo: { removedCount: number; messagesAfterCheckpoint: number; } | null;
  // 最后一条 assistant 消息的元数据（用于 Context 组件显示 token 用量）
  lastAssistantMetadata: MessageMetadata | undefined;
  // 侧边栏开关状态
  sidebarOpen: boolean;
  // useChat 错误状态（用于 UI 显示错误提示）
  error: Error | undefined;
}

/**
 * 操作函数接口
 * 包含所有用户交互操作
 */
interface AgentChatActions {
  // 获取对话列表
  fetchConversations: () => Promise<Conversation[]>;
  // 新建对话
  handleNewChat: () => void;
  // 选择对话
  handleSelectConversation: (conversationId: string) => void;
  // 删除对话
  handleDeleteConversation: (deleteId: string) => Promise<void>;
  // 重命名对话
  handleRenameConversation: (renameId: string, newTitle: string) => Promise<void>;
  // 发送消息
  handleSubmit: (message: { text: string }) => Promise<void>;
  // 打开删除确认对话框
  handleDeleteClick: (messageId: string) => void;
  // 确认删除消息
  handleConfirmDelete: () => Promise<void>;
  // 关闭删除确认对话框
  closeDeleteDialog: () => void;
  // 打开编辑确认对话框
  handleEditClick: (messageId: string) => void;
  // 确认编辑消息
  handleConfirmEdit: () => Promise<void>;
  // 关闭编辑确认对话框
  closeEditDialog: () => void;
  // 停止生成
  stop: () => void;
  // 设置侧边栏开关
  setSidebarOpen: (open: boolean) => void;
  // 设置选中的 Agent ID
  setSelectedAgentId: (agentId: string) => void;
  // 重试发送消息（用于 401 等错误后手动重试）
  reload: () => void;
}

/**
 * 元数据状态接口
 * 包含对话框状态、输入框状态等
 */
interface AgentChatMeta {
  // 最新 checkpoint 的索引位置（用于判断消息是否可删除）
  latestCheckpointIndex: number;
  // 输入框预填充内容（用于编辑后填入输入框）
  prefillInput: string;
  // 输入框 key，用于强制重新渲染
  inputKey: number;
  // 删除确认对话框开关
  deleteDialogOpen: boolean;
  // 编辑确认对话框开关
  editDialogOpen: boolean;
  // 是否正在删除
  isDeleting: boolean;
  // 是否正在编辑
  isEditing: boolean;
}

/**
 * Context 值接口
 * 组合 state、actions、meta
 */
interface AgentChatContextValue {
  state: AgentChatState;
  actions: AgentChatActions;
  meta: AgentChatMeta;
}

// ==================== Context 创建 ====================

// 创建 Context，初始值为 null
const AgentChatContext = createContext<AgentChatContextValue | null>(null);

// ==================== Hook 导出 ====================

/**
 * 使用 AgentChat Context 的 Hook
 * 必须在 AgentChatProvider 内使用
 */
export function useAgentChatContext() {
  const context = use(AgentChatContext);
  if (!context) {
    throw new Error("AgentChat components must be used within AgentChatProvider");
  }
  return context;
}

// ==================== 导出 ====================

export { AgentChatContext };
export type {
  AgentChatState,
  AgentChatActions,
  AgentChatMeta,
  AgentChatContextValue
};

// ==================== Provider 实现 ====================

/**
 * AgentChatProvider Props
 */
interface AgentChatProviderProps {
  // 当前对话 ID（来自 URL 参数）
  conversationId: string;
  // 子组件
  children: React.ReactNode;
}

/**
 * AgentChatProvider 组件
 * 提供全局状态管理，包含所有状态逻辑
 */
export function AgentChatProvider({ conversationId, children }: AgentChatProviderProps) {
  const router = useRouter();
  // 获取认证请求方法
  const { authenticatedFetch } = useAuth();

  // ==================== 核心状态变量 ====================

  // 移动端侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 对话列表
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // 加载状态
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  // 当前选中的 Agent ID
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  // Agent ID ref（用于 transport 配置中访问最新值）
  const agentIdRef = useRef<string>(selectedAgentId);

  // ==================== Checkpoint 信息 ====================

  // 存储 API 返回的 checkpoint 信息（用于判断消息删除权限）
  // checkpoint 数据存储在独立的 checkpoints 表中
  const [checkpointInfo, setCheckpointInfo] = useState<{
    removedCount: number;
    messagesAfterCheckpoint: number;
  } | null>(null);

  // ==================== 消息撤回相关状态 ====================

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // 要删除的消息 ID
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  // 删除中状态
  const [isDeleting, setIsDeleting] = useState(false);

  // ==================== 消息编辑相关状态 ====================

  // 编辑确认对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // 要编辑的消息 ID
  const [messageToEdit, setMessageToEdit] = useState<string | null>(null);
  // 编辑中的消息内容（删除后填入输入框）
  const [editContent, setEditContent] = useState("");
  // 编辑确认中状态
  const [isEditing, setIsEditing] = useState(false);
  // 输入框预填充内容（用于编辑后填入输入框）
  const [prefillInput, setPrefillInput] = useState("");
  // 输入框 key，用于强制重新渲染
  const [inputKey, setInputKey] = useState(0);

  // ==================== URL 更新标记 ====================

  // 标记是否已更新 URL（用于新建对话后更新 URL）
  const hasUpdatedUrl = useRef(false);

  // ==================== 更新 ref ====================

  // 更新 agentIdRef，确保 transport 中能获取最新值
  useEffect(() => {
    agentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  // ==================== Transport 配置 ====================

  // 创建 transport - 使用 prepareSendMessagesRequest 只发送最后一条消息
  // 符合 AI SDK 最佳实践，避免前端发送完整消息列表导致重复
  //
  // 注意：不在此处使用 headers: getAuthHeader，原因是 useChat 内部的 Chat
  // 实例会缓存 transport 引用。当 accessToken 从 null 变为有效值时，虽然
  // transport 会重新创建，但 Chat 仍引用旧的 transport，导致旧的 getAuthHeader
  // 闭包（返回空对象）被调用，请求不带 Authorization header，返回 401。
  // 解决方案：在 prepareSendMessagesRequest 中直接读取 localStorage，绕过 React
  // state 闭包问题。
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/agent-chat",
      // 使用 prepareSendMessagesRequest 只发送最后一条消息，并在其中动态读取 token
      prepareSendMessagesRequest({ messages, id: chatId, headers: baseHeaders }) {
        // 每次请求时实时读取 token，避免 React state 闭包问题
        // Chat 实例缓存旧 transport 不影响此处，因为 prepareSendMessagesRequest
        // 中的逻辑不依赖 React state 闭包，而是直接读取 localStorage
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
            message: messages[messages.length - 1], // 只发送最后一条消息
            conversationId: chatId,                   // AI SDK 传入的对话 ID
            agentId: agentIdRef.current,
          },
        };
      },
    });
  }, [conversationId]);

  // ==================== 刷新 checkpoint 信息 ====================

  // 刷新 checkpoint 信息（用于消息流结束后更新分割线位置）
  // 压缩任务在下一次 API 调用时执行，所以需要在消息完成后刷新 checkpointInfo
  const refreshCheckpointInfo = useCallback(async () => {
    // 如果没有对话 ID 或在新建对话页面，不需要刷新
    if (!conversationId || window.location.pathname === NEW_CHAT_PATH) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.checkpoint) {
          setCheckpointInfo({
            removedCount: data.checkpoint.removedCount,
            messagesAfterCheckpoint: data.checkpoint.messagesAfterCheckpoint,
          });
        } else {
          setCheckpointInfo(null);
        }
      }
    } catch (error) {
      console.error("刷新 checkpoint 信息失败:", error);
    }
  }, [conversationId, authenticatedFetch]);

  // ==================== useChat hook ====================

  // useChat hook - 核心 AI 对话功能
  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
    reload,
  } = useChat({
    transport,
    id: conversationId,
    // 消息流结束后执行回调：刷新 checkpoint、对话列表，并更新新建对话的 URL
    onFinish: ({ finishReason, isAbort }) => {
      // 出错或中断时跳过非关键刷新
      if (finishReason === "error" || isAbort) return;
      // 刷新 checkpoint 信息（压缩任务在下一次 API 调用时执行，需要重新获取）
      refreshCheckpointInfo();
      // 刷新对话列表（确保新对话出现在侧边栏）
      fetchConversations();
      // 如果在新建对话页面，更新 URL 为具体对话地址
      if (!hasUpdatedUrl.current && window.location.pathname === NEW_CHAT_PATH) {
        hasUpdatedUrl.current = true;
        window.history.pushState({}, "", `/agent-chat/${conversationId}`);
      }
    },
    // 错误处理：记录错误日志，UI 层显示错误提示和 Retry 按钮
    onError: (error) => {
      console.error("[agent-chat] 发送消息失败:", error);
    },
  });

  // ==================== 监听浏览器前进/后退 ====================

  useEffect(() => {
    const handlePopState = () => {
      router.refresh();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // ==================== 获取对话列表 ====================

  // 获取 Agent 对话列表
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
      console.error("获取 Agent 对话列表失败:", error);
    } finally {
      setIsLoadingConversations(false);
    }
    return [];
  }, [authenticatedFetch]);

  // ==================== 初始加载对话列表 ====================

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ==================== 获取已有对话的消息 ====================

  useEffect(() => {
    // 如果在新建对话页面，清空消息
    if (window.location.pathname === NEW_CHAT_PATH) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        // 使用 authenticatedFetch 支持自动刷新 token
        const response = await authenticatedFetch(`/api/conversations/${conversationId}`);

        if (response.ok) {
          const data = await response.json();
          // 使用 API 返回的 metadataContext（包含 contextLimit 和 modelName）
          // 用于历史消息显示 Context 组件的 token 用量
          const metadataContext = data.metadataContext;
          const uiMessages = (data.messages || []).map((msg: any) =>
            dbMessageToUIMessage(msg, metadataContext)
          );
          setMessages(uiMessages);

          // 保存 checkpoint 信息（用于判断消息删除权限）
          // checkpoint 数据存储在独立表中
          if (data.checkpoint) {
            setCheckpointInfo({
              removedCount: data.checkpoint.removedCount,
              messagesAfterCheckpoint: data.checkpoint.messagesAfterCheckpoint,
            });
          } else {
            setCheckpointInfo(null);
          }

          // 设置 Agent ID
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

  // ==================== 操作函数：新建对话 ====================

  const handleNewChat = useCallback(() => {
    setSidebarOpen(false);
    setSelectedAgentId("");
    // 重置URL更新标志，确保新对话的URL能正确更新
    hasUpdatedUrl.current = false;
    router.push(NEW_CHAT_PATH);
  }, [router]);

  // ==================== 操作函数：选择对话 ====================

  const handleSelectConversation = useCallback((targetId: string) => {
    setSidebarOpen(false);
    // 重置URL更新标志，确保切换对话后新对话的URL能正确更新
    hasUpdatedUrl.current = false;
    router.push(`/agent-chat/${targetId}`);
  }, [router]);

  // ==================== 操作函数：删除对话 ====================

  const handleDeleteConversation = useCallback(async (deleteId: string) => {
    try {
      // 使用 authenticatedFetch 支持自动刷新 token
      const response = await authenticatedFetch(`/api/conversations/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deleteId));
        // 如果删除的是当前对话，跳转到新建对话页面
        if (conversationId === deleteId) {
          router.push(NEW_CHAT_PATH);
        }
      }
    } catch (error) {
      console.error("删除对话失败:", error);
    }
  }, [conversationId, router, authenticatedFetch]);

  // ==================== 操作函数：重命名对话 ====================

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

  // ==================== 操作函数：打开删除确认对话框 ====================

  const handleDeleteClick = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  }, []);

  // ==================== 操作函数：确认删除消息 ====================

  // 级联删除该消息及之后的所有消息
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

      // 刷新对话列表
      await fetchConversations();

      // 清除本地消息状态（级联删除后本地状态已失效）
      setMessages([]);

      // 刷新页面以更新消息列表
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

  // ==================== 操作函数：关闭删除确认对话框 ====================

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  }, []);

  // ==================== 操作函数：打开编辑确认对话框 ====================

  // 用户确认后，删除消息并将内容填入输入框
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

  // ==================== 操作函数：确认编辑消息 ====================

  // 删除原消息（级联删除后续消息），然后将内容填入输入框
  const handleConfirmEdit = useCallback(async () => {
    if (!messageToEdit || !editContent.trim()) return;

    setIsEditing(true);
    try {
      // 调用删除 API（级联删除该消息及后续所有消息）
      const response = await authenticatedFetch(
        `/api/messages/${messageToEdit}/delete`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除失败");
      }

      // 刷新对话列表
      await fetchConversations();

      // 清除本地消息状态（级联删除后本地状态已失效）
      setMessages([]);

      // 将消息内容填入输入框
      setPrefillInput(editContent);
      // 强制重新渲染输入框
      setInputKey((prev) => prev + 1);

      // 刷新页面以更新消息列表
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

  // ==================== 操作函数：关闭编辑确认对话框 ====================

  const closeEditDialog = useCallback(() => {
    setEditDialogOpen(false);
    setMessageToEdit(null);
    setEditContent("");
  }, []);

  // ==================== 操作函数：发送消息 ====================

  const handleSubmit = useCallback(async (message: { text: string }) => {
    // 验证 Agent 已选择
    if (!agentIdRef.current) {
      alert("请先选择一个 Agent");
      return;
    }

    await sendMessage({ text: message.text });
    // 列表刷新与 URL 更新已移至 onFinish 回调，确保在流式响应完成后执行
  }, [sendMessage]);

  // ==================== 计算值 ====================

  // 当前对话对象
  const currentConversation = conversations.find((c) => c.id === conversationId);

  // 是否正在生成消息
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
  // checkpoint 数据存储在独立表中，使用 API 返回的 checkpointInfo 计算
  // checkpoint 之前的消息（索引 < latestCheckpointIndex）不能删除
  const latestCheckpointIndex = useMemo(() => {
    // 没有 checkpoint，所有消息都可以删除
    if (!checkpointInfo) {
      return -1;
    }
    // 计算 checkpoint 之后的第一个消息的索引
    // messagesAfterCheckpoint 是 checkpoint 之后的消息数量
    // 所以 checkpoint 之前的消息数量 = messages.length - messagesAfterCheckpoint
    const messagesBeforeCheckpoint = messages.length - checkpointInfo.messagesAfterCheckpoint;
    // 如果没有消息在 checkpoint 之前，返回 -1
    if (messagesBeforeCheckpoint <= 0) {
      return -1;
    }
    // 返回 checkpoint 之前的最后一条消息的索引
    // 索引 0 到 messagesBeforeCheckpoint - 1 是 checkpoint 之前的消息
    return messagesBeforeCheckpoint - 1;
  }, [messages.length, checkpointInfo]);

  // ==================== Context Value 构建 ====================

  // 构建 state 层：核心数据状态
  const state: AgentChatState = {
    conversations,
    currentConversationId: conversationId,
    currentConversation,
    messages,
    isLoadingConversations,
    isGenerating,
    status,
    selectedAgentId,
    checkpointInfo,
    lastAssistantMetadata,
    sidebarOpen,
    error,
  };

  // 构建 actions 层：操作函数
  const actions: AgentChatActions = {
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

  // 构建 meta 层：元数据状态
  const meta: AgentChatMeta = {
    latestCheckpointIndex,
    prefillInput,
    inputKey,
    deleteDialogOpen,
    editDialogOpen,
    isDeleting,
    isEditing,
  };

  // 完整的 Context 值
  const contextValue: AgentChatContextValue = {
    state,
    actions,
    meta,
  };

  // ==================== Provider 渲染 ====================

  return (
    <AgentChatContext.Provider value={contextValue}>
      {children}
    </AgentChatContext.Provider>
  );
}