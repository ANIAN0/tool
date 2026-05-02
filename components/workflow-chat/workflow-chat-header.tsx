"use client";

/**
 * WorkflowChat 顶部导航组件
 * 极简设计：紧凑、功能性强、去除冗余信息
 */

import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import { DbAgentSelector } from "@/components/agent-chat/db-agent-selector";
import { UserMenu } from "@/components/auth/user-menu";
import { useWorkflowChatContext } from "./workflow-chat-context";
import { Menu } from "lucide-react";

/**
 * WorkflowChatHeader组件
 * 顶部导航区域，极简设计：
 * - 去除冗余副标题，聚焦核心信息
 * - 紧凑布局，不占用过多空间
 * - 去除底部边框，使用微妙分隔
 */
export function WorkflowChatHeader() {
  // 从 Context 获取状态和操作
  const { state, actions } = useWorkflowChatContext();

  // 检查是否有会话，累计 token 大于 0
  const hasTokenUsage = state.currentConversation && 
    state.currentConversation.total_tokens && 
    state.currentConversation.total_tokens > 0;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-6">
      {/* 左侧：移动端菜单按钮 + 标题 */}
      <div className="flex items-center gap-3">
        {/* 移动端菜单按钮 */}
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent/50 transition-colors md:hidden"
          onClick={() => actions.setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* 标题：去除副标题，更聚焦 */}
        <h1 className="text-base font-medium text-foreground truncate max-w-[200px]">
          {state.currentConversation?.title || "新对话"}
        </h1>
      </div>

      {/* 右侧：Context组件 + Agent选择器 + 用户菜单 */}
      <div className="flex items-center gap-3">
        {/* Context组件：显示会话累计 token 使用情况 */}
        {hasTokenUsage && state.lastAssistantMetadata && (
          <Context
            maxTokens={state.lastAssistantMetadata.contextLimit}
            usedTokens={state.currentConversation?.total_input_tokens || 0}
            usage={{
              // 使用数据库累计值
              inputTokens: state.currentConversation?.total_input_tokens || 0,
              outputTokens: state.currentConversation?.total_output_tokens || 0,
              totalTokens: state.currentConversation?.total_tokens || 0,
              // 缓存和推理token从最后一条消息获取（累计值数据库未存储）
              cachedInputTokens:
                state.lastAssistantMetadata.usage.inputTokenDetails?.cacheReadTokens,
              reasoningTokens:
                state.lastAssistantMetadata.usage.outputTokenDetails?.reasoningTokens,
              inputTokenDetails: state.lastAssistantMetadata.usage.inputTokenDetails,
              outputTokenDetails: state.lastAssistantMetadata.usage.outputTokenDetails,
            }}
            modelId={state.lastAssistantMetadata.modelName}
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

        {/* Agent选择器：新会话可用，已有会话禁用 */}
        <DbAgentSelector
          onChange={actions.setSelectedAgentId}
          value={state.selectedAgentId}
          disabled={!!state.currentConversation}
        />

        {/* 用户菜单 */}
        <UserMenu />
      </div>
    </header>
  );
}