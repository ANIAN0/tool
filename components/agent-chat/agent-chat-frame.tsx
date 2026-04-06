"use client";

/**
 * AgentChat外层容器布局组件
 * 包含侧边栏、遮罩层和右侧对话区
 */

import { AgentChatSidebar } from "./sidebar";
import { useAgentChatContext } from "./agent-chat-context";

/**
 * AgentChatFrame组件
 * 外层容器布局，包含侧边栏和主对话区
 */
export function AgentChatFrame({ children }: { children: React.ReactNode }) {
  // 从 Context 获取状态和操作
  const { state, actions } = useAgentChatContext();

  return (
    <div className="flex h-screen">
      {/* 左侧边栏 */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transform overflow-hidden border-r border-border bg-background
          transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${state.sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <AgentChatSidebar
          conversations={state.conversations}
          currentConversationId={state.currentConversationId}
          isLoading={state.isLoadingConversations}
          onClose={() => actions.setSidebarOpen(false)}
          onNewChat={actions.handleNewChat}
          onSelectConversation={actions.handleSelectConversation}
          onDeleteConversation={actions.handleDeleteConversation}
          onRenameConversation={actions.handleRenameConversation}
        />
      </aside>

      {/* 移动端遮罩层 */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => actions.setSidebarOpen(false)}
        />
      )}

      {/* 右侧对话区 - children 由父组件传入 */}
      {children}
    </div>
  );
}