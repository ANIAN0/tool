"use client";

/**
 * AgentChat顶部导航组件
 * 包含移动端菜单按钮、标题、Context组件、Agent选择器、用户菜单
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
import { DbAgentSelector } from "./db-agent-selector";
import { UserMenu } from "@/components/auth/user-menu";
import { useAgentChatContext } from "./agent-chat-context";
import { Menu } from "lucide-react";

/**
 * AgentChatHeader组件
 * 顶部导航区域，显示标题、Agent选择器和用户菜单
 */
export function AgentChatHeader() {
  // 从 Context 获取状态和操作
  const { state, actions } = useAgentChatContext();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
      {/* 左侧：移动端菜单按钮 + 标题 */}
      <div className="flex items-center gap-4">
        {/* 移动端菜单按钮 */}
        <button
          className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent md:hidden"
          onClick={() => actions.setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* 标题和副标题 */}
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">
            {state.currentConversation?.title || "Agent对话"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {state.currentConversation ? "继续对话..." : "选择Agent开始对话"}
          </p>
        </div>
      </div>

      {/* 右侧：Context组件 + Agent选择器 + 用户菜单 */}
      <div className="flex items-center gap-2">
        {/* Context组件：显示会话累计 token 使用情况 */}
        {state.currentConversation &&
          state.currentConversation.total_tokens > 0 &&
          state.lastAssistantMetadata && (
            <Context
              maxTokens={state.lastAssistantMetadata.contextLimit}
              usedTokens={state.currentConversation.total_input_tokens}
              usage={{
                // 使用数据库累计值
                inputTokens: state.currentConversation.total_input_tokens,
                outputTokens: state.currentConversation.total_output_tokens,
                totalTokens: state.currentConversation.total_tokens,
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

        {/* Agent选择器 */}
        <DbAgentSelector
          onChange={actions.setSelectedAgentId}
          value={state.selectedAgentId}
          disabled={state.currentConversation !== undefined}
        />

        {/* 用户菜单 */}
        <UserMenu />
      </div>
    </header>
  );
}