"use client";

/**
 * AgentChat 组合组件入口
 * 将复杂的聊天组件拆分为组合模式，支持灵活组合和扩展
 */

// 导入所有组合子组件
import { AgentChatProvider } from "./agent-chat-context";
import { AgentChatFrame } from "./agent-chat-frame";
import { AgentChatHeader } from "./agent-chat-header";
import { AgentChatConversation } from "./agent-chat-conversation";
import { AgentChatInput } from "./agent-chat-input";
import { AgentChatDialogs } from "./agent-chat-dialogs";

/**
 * AgentChatClient 组件 Props
 */
interface AgentChatClientProps {
  // 当前对话 ID（来自 URL 参数）
  id: string;
}

/**
 * AgentChatClient 组件
 * 组合组件模式的入口，组合各个子组件构成完整的聊天界面
 */
export function AgentChatClient({ id }: AgentChatClientProps) {
  return (
    // Provider: 提供全局状态管理
    <AgentChatProvider conversationId={id}>
      {/* Frame: 外层布局容器，包含侧边栏 */}
      <AgentChatFrame>
        {/* Header: 顶部导航 */}
        <AgentChatHeader />
        {/* Conversation: 消息列表区域 */}
        <AgentChatConversation />
        {/* Input: 输入区域 */}
        <AgentChatInput />
      </AgentChatFrame>
      {/* Dialogs: 对话框组件（删除/编辑确认） */}
      <AgentChatDialogs />
    </AgentChatProvider>
  );
}

/**
 * AgentChat 复合对象
 * 导出所有子组件供外部灵活组合使用
 *
 * 使用示例：
 * // 标准用法
 * <AgentChat.Client id="conversation-id" />
 *
 * // 自定义组合
 * <AgentChat.Provider conversationId="id">
 *   <AgentChat.Frame>
 *     <CustomHeader />
 *     <AgentChat.Conversation />
 *     <AgentChat.Input />
 *   </AgentChat.Frame>
 * </AgentChat.Provider>
 */
export const AgentChat = {
  Provider: AgentChatProvider,
  Frame: AgentChatFrame,
  Header: AgentChatHeader,
  Conversation: AgentChatConversation,
  Input: AgentChatInput,
  Dialogs: AgentChatDialogs,
  // 别名：Client 是默认的完整组件
  Client: AgentChatClient,
};