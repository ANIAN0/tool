"use client";

/**
 * AgentChat输入区域组件
 * 包含PromptSection组件
 */

import { PromptSection } from "./prompt-section";
import { useAgentChatContext } from "./agent-chat-context";

/**
 * AgentChatInput组件
 * 输入区域，显示PromptSection组件
 */
export function AgentChatInput() {
  // 从 Context 获取状态、操作和元数据
  const { state, actions, meta } = useAgentChatContext();

  return (
    <div className="px-6 py-6">
      {/* 使用 meta.inputKey 强制重新渲染 */}
      {/* 使用 meta.prefillInput 预填充编辑内容 */}
      <PromptSection
        key={meta.inputKey}
        onSubmit={actions.handleSubmit}
        onStop={actions.stop}
        status={state.isGenerating ? "streaming" : "ready"}
        placeholder="输入消息，按 Enter 发送..."
        prefillInput={meta.prefillInput}
      />
    </div>
  );
}