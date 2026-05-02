"use client";

/**
 * WorkflowChat 组合组件入口
 * 将复杂的聊天组件拆分为组合模式，支持灵活组合和扩展
 * 完全复制 AgentChatClient 的组合模式
 */

// 导入所有组合子组件
import { WorkflowChatProvider } from "./workflow-chat-context";
import { WorkflowChatFrame } from "./workflow-chat-frame";
import { WorkflowChatHeader } from "./workflow-chat-header";
import { WorkflowChatConversation } from "./workflow-chat-conversation";
import { WorkflowChatInput } from "./workflow-chat-input";
import { WorkflowChatDialogs } from "./workflow-chat-dialogs";

/**
 * WorkflowChatClient 组件 Props
 */
interface WorkflowChatClientProps {
  // 当前对话 ID（来自 URL 参数）
  id: string;
}

/**
 * WorkflowChatClient 组件
 * 组合组件模式的入口，组合各个子组件构成完整的聊天界面
 */
export function WorkflowChatClient({ id }: WorkflowChatClientProps) {
  return (
    // Provider: 提供全局状态管理
    <WorkflowChatProvider conversationId={id}>
      {/* Frame: 外层布局容器，包含侧边栏 */}
      <WorkflowChatFrame>
        {/* Header: 顶部导航 */}
        <WorkflowChatHeader />
        {/* Conversation: 消息列表区域 */}
        <WorkflowChatConversation />
        {/* Input: 输入区域 */}
        <WorkflowChatInput />
      </WorkflowChatFrame>
      {/* Dialogs: 对话框组件（删除/编辑确认） */}
      <WorkflowChatDialogs />
    </WorkflowChatProvider>
  );
}

/**
 * WorkflowChat 复合对象
 * 导出所有子组件供外部灵活组合使用
 *
 * 使用示例：
 * // 标准用法
 * <WorkflowChat.Client id="conversation-id" />
 *
 * // 自定义组合
 * <WorkflowChat.Provider conversationId="id">
 *   <WorkflowChat.Frame>
 *     <CustomHeader />
 *     <WorkflowChat.Conversation />
 *     <WorkflowChat.Input />
 *   </WorkflowChat.Frame>
 * </WorkflowChat.Provider>
 */
export const WorkflowChat = {
  Provider: WorkflowChatProvider,
  Frame: WorkflowChatFrame,
  Header: WorkflowChatHeader,
  Conversation: WorkflowChatConversation,
  Input: WorkflowChatInput,
  Dialogs: WorkflowChatDialogs,
  // 别名：Client 是默认的完整组件
  Client: WorkflowChatClient,
};