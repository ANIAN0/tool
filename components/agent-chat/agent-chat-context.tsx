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

import { createContext, use } from "react";
import type { Conversation } from "@/lib/db/schema";
import type { MessageMetadata } from "./message-actions";
import type { UIMessage } from "ai";

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
  // 当前选中的 Agent ID
  selectedAgentId: string;
  // Checkpoint 信息（用于消息删除权限判断）
  checkpointInfo: { removedCount: number; messagesAfterCheckpoint: number; } | null;
  // 最后一条 assistant 消息的元数据（用于 Context 组件显示 token 用量）
  lastAssistantMetadata: MessageMetadata | undefined;
  // 侧边栏开关状态
  sidebarOpen: boolean;
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
  // 打开编辑确认对话框
  handleEditClick: (messageId: string) => void;
  // 确认编辑消息
  handleConfirmEdit: () => Promise<void>;
  // 停止生成
  stop: () => void;
  // 设置侧边栏开关
  setSidebarOpen: (open: boolean) => void;
  // 设置选中的 Agent ID
  setSelectedAgentId: (agentId: string) => void;
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