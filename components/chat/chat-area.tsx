"use client";

/**
 * 对话消息区域组件
 * 使用AI Elements的Conversation系列组件构建消息显示区域
 * 功能点15：对话消息区域组件
 * 功能点23：支持流式消息显示
 */

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import type { UIMessage } from "ai";
import { MessageSquareIcon } from "lucide-react";

/**
 * ChatArea组件的Props
 */
interface ChatAreaProps {
  // 消息列表（UIMessage格式，支持流式消息）
  messages: UIMessage[];
  // 是否加载中
  isLoading?: boolean;
  // 加载状态文本
  loadingText?: string;
}

/**
 * 对话消息区域组件
 */
export function ChatArea({
  messages,
  isLoading = false,
  loadingText = "加载中...",
}: ChatAreaProps) {
  // 是否有消息
  const hasMessages = messages.length > 0;

  return (
    <Conversation className="flex-1">
      {/* 有消息时显示消息列表 */}
      {hasMessages && (
        <ConversationContent>
          {messages.map((message) => (
            <Message
              from={message.role}
              key={message.id}
            >
              <MessageContent>
                {/* 渲染消息内容 */}
                {message.parts.map((part, index) => {
                  // 处理文本部分
                  if (part.type === "text") {
                    return (
                      <MessageResponse key={index}>
                        {part.text}
                      </MessageResponse>
                    );
                  }
                  // 其他类型暂不处理
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
      )}

      {/* 加载中状态 */}
      {isLoading && !hasMessages && (
        <ConversationEmptyState
          description={loadingText}
          title="正在加载"
        />
      )}

      {/* 空状态 */}
      {!isLoading && !hasMessages && (
        <ConversationEmptyState
          description="选择一个对话或创建新对话开始聊天"
          icon={<MessageSquareIcon className="size-10" />}
          title="开始对话"
        />
      )}

      {/* 滚动到底部按钮 */}
      <ConversationScrollButton />
    </Conversation>
  );
}
