"use client";

/**
 * AgentChat输入区域组件
 * 极简设计：融入整体，简洁舒适
 */

import { PromptSection } from "./prompt-section";
import { useAgentChatContext } from "./agent-chat-context";

/**
 * AgentChatInput组件
 * 输入区域，极简设计：
 * - 更多的留白，视觉呼吸感
 * - 简洁融入整体布局
 */
export function AgentChatInput() {
  // 从 Context 获取状态、操作和元数据
  const { state, actions, meta } = useAgentChatContext();

  return (
    <div className="px-8 py-6">
      {/* 使用 meta.inputKey 强制重新渲染 */}
      {/* 使用 meta.prefillInput 预填充编辑内容 */}
      <PromptSection
        key={meta.inputKey}
        onSubmit={actions.handleSubmit}
        onStop={actions.stop}
        status={state.status}
        placeholder="输入消息..."
        prefillInput={meta.prefillInput}
      />
    </div>
  );
}