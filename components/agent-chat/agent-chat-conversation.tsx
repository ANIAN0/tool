"use client";

/**
 * AgentChat消息列表区域组件
 * 包含消息渲染、checkpoint分割线、MessageActions
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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { MessageActions, type MessageMetadata } from "./message-actions";
import { useAgentChatContext } from "./agent-chat-context";
import { isToolPart, isStepStartPart, isCheckpointPart } from "@/lib/agent-chat";
import { MessageSquareIcon } from "lucide-react";

/**
 * AgentChatConversation组件
 * 消息列表区域，渲染所有消息和checkpoint分割线
 */
export function AgentChatConversation() {
  // 从 Context 获取状态和操作
  const { state, actions, meta } = useAgentChatContext();

  return (
    <div className="flex-1 overflow-hidden">
      <Conversation className="h-full">
        <ConversationContent className="px-6 py-6">
          {state.messages.length > 0 ? (
            state.messages.map((message, index) => {
              // 跳过旧的 checkpoint 消息（兼容历史数据）
              const checkpointPart = message.parts.find((p) => isCheckpointPart(p));
              if (checkpointPart) {
                return null;
              }

              // 获取当前消息的元数据
              const messageMetadata = message.metadata as MessageMetadata | undefined;
              // 判断是否可以删除：checkpoint之前的消息不能删除
              const canDelete =
                meta.latestCheckpointIndex === -1 || index > meta.latestCheckpointIndex;

              // 计算是否需要显示checkpoint分割线
              // 分割线显示在checkpoint之后的第一条消息之前
              // latestCheckpointIndex是checkpoint之前的最后一条消息的索引
              // 所以分割线在latestCheckpointIndex + 1的位置显示
              const showCheckpointDivider =
                state.checkpointInfo &&
                state.checkpointInfo.removedCount > 0 &&
                meta.latestCheckpointIndex >= 0 &&
                index === meta.latestCheckpointIndex + 1;

              return (
                <div key={message.id}>
                  {/* Checkpoint分割线：显示在正确的位置 */}
                  {showCheckpointDivider && state.checkpointInfo && (
                    <div className="flex items-center gap-2 my-4 py-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        已压缩 {state.checkpointInfo.removedCount} 条历史消息
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  <div className="group relative mb-4">
                    <Message from={message.role}>
                      <MessageContent className="max-w-3xl">
                        {message.parts.map((part, partIndex) => {
                          // 渲染文本类型
                          if (part.type === "text") {
                            return (
                              <MessageResponse key={partIndex}>
                                {part.text}
                              </MessageResponse>
                            );
                          }

                          // 渲染工具调用类型
                          if (isToolPart(part)) {
                            const toolPart = part as ToolPart;
                            const defaultOpen =
                              toolPart.state === "output-available" ||
                              toolPart.state === "output-error";
                            const isDynamicTool = toolPart.type === "dynamic-tool";
                            const dynamicPart = toolPart as { toolName?: string };

                            return (
                              <Tool key={partIndex} defaultOpen={defaultOpen}>
                                {isDynamicTool ? (
                                  <ToolHeader
                                    type="dynamic-tool"
                                    state={toolPart.state}
                                    toolName={dynamicPart.toolName || "unknown"}
                                  />
                                ) : (
                                  <ToolHeader
                                    type={toolPart.type as `tool-${string}`}
                                    state={toolPart.state}
                                  />
                                )}
                                <ToolContent>
                                  <ToolInput input={toolPart.input} />
                                  <ToolOutput
                                    output={toolPart.output}
                                    errorText={toolPart.errorText}
                                  />
                                </ToolContent>
                              </Tool>
                            );
                          }

                          // 渲染步骤开始分割线
                          if (isStepStartPart(part)) {
                            return (
                              <div
                                key={partIndex}
                                className="flex items-center gap-2 my-2"
                              >
                                <div className="flex-1 h-px bg-border" />
                              </div>
                            );
                          }

                          return null;
                        })}
                      </MessageContent>
                    </Message>

                    {/* 消息操作栏：token信息 + 操作按钮 */}
                    <div className="mt-1 ml-2">
                      <MessageActions
                        role={message.role}
                        content={message.parts
                          .filter((p) => p.type === "text")
                          .map((p) => (p as { type: "text"; text: string }).text)
                          .join("\n")}
                        metadata={messageMetadata}
                        isGenerating={state.isGenerating}
                        // 只有user消息才显示删除按钮（agent消息不能删除）
                        onDelete={
                          message.role === "user" && canDelete
                            ? () => actions.handleDeleteClick(message.id)
                            : undefined
                        }
                        onEdit={
                          message.role === "user" && canDelete
                            ? () => actions.handleEditClick(message.id)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // 空状态
            <ConversationEmptyState
              description="选择一个Agent开始对话"
              icon={<MessageSquareIcon className="w-10 h-10" />}
              title="Agent对话"
              className="mt-16"
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}