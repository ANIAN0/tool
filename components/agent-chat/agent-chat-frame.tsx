"use client";

/**
 * AgentChat外层容器布局组件
 * 极简布局：侧边栏作为安静的工具，主对话区占据视觉主导
 */

import { AgentChatSidebar } from "./sidebar";
import { useAgentChatContext } from "./agent-chat-context";

/**
 * AgentChatFrame组件
 * 外层容器布局，包含侧边栏和主对话区
 *
 * 设计理念：
 * - 极简内容导向：侧边栏更窄（220px），不抢夺注意力
 * - 去除不必要的边框分隔，使用微妙的视觉层次
 * - 布局流畅，给予内容区最大空间
 */
export function AgentChatFrame({ children }: { children: React.ReactNode }) {
  // 从 Context 获取状态和操作
  const { state, actions } = useAgentChatContext();

  return (
    <div className="flex h-screen bg-background">
      {/* 左侧边栏 - 更窄、无边框、安静的设计 */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[220px] transform overflow-hidden
          bg-muted/30 transition-transform duration-200 ease-in-out
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

      {/* 移动端遮罩层 - 更轻柔的遮罩 */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => actions.setSidebarOpen(false)}
        />
      )}

      {/* 右侧对话区 - 无边框，内容主导 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}