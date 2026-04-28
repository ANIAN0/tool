"use client";

/**
 * AgentChat消息列表区域组件
 * 极简设计：内容主导，大量留白，舒适的阅读体验
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
import { isToolPart, isStepStartPart, isCheckpointPart } from "@/lib/agent-chat/utils";
import { MessageSquareIcon } from "lucide-react";

/**
 * AgentChatConversation组件
 * 消息列表区域，极简设计：
 * - 更宽的内容区域（max-w-4xl），提升阅读体验
 * - 舒适的消息间距（mb-6），减少拥挤感
 * - 去除不必要的装饰，聚焦内容本身
 */
export function AgentChatConversation() {
  // 从 Context 获取状态和操作
  const { state, actions, meta } = useAgentChatContext();

  return (
    <div className="flex-1 overflow-hidden">
      <Conversation className="h-full">
        {/* 更宽的内容区域，更多留白 */}
        <ConversationContent className="px-8 py-8">
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
              const showCheckpointDivider =
                state.checkpointInfo &&
                state.checkpointInfo.removedCount > 0 &&
                meta.latestCheckpointIndex >= 0 &&
                index === meta.latestCheckpointIndex + 1;

              return (
                <div key={message.id}>
                  {/* Checkpoint分割线：更干净的设计 */}
                  {showCheckpointDivider && state.checkpointInfo && (
                    <div className="flex items-center gap-4 my-6">
                      <div className="flex-1 h-px bg-border/50" />
                      <span className="text-xs text-muted-foreground/70 px-3">
                        {state.checkpointInfo.removedCount} 条历史已压缩
                      </span>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>
                  )}

                  {/* 消息容器：更大的间距 */}
                  <div className="group relative mb-6">
                    <Message from={message.role}>
                      {/* 更宽的内容区域：max-w-4xl */}
                      <MessageContent className="max-w-4xl">
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

                          // 渲染步骤开始分割线：更淡的线条
                          if (isStepStartPart(part)) {
                            return (
                              <div
                                key={partIndex}
                                className="flex items-center gap-2 my-3"
                              >
                                <div className="flex-1 h-px bg-border/30" />
                              </div>
                            );
                          }

                          return null;
                        })}
                      </MessageContent>
                    </Message>

                    {/* 消息操作栏：用户消息右对齐，助手消息左对齐 */}
                    <div className={`mt-1 flex ${message.role === "user" ? "justify-end" : ""}`}>
                      <MessageActions
                        role={message.role}
                        content={message.parts
                          .filter((p) => p.type === "text")
                          .map((p) => (p as { type: "text"; text: string }).text)
                          .join("\n")}
                        metadata={messageMetadata}
                        isGenerating={state.isGenerating}
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
            // 空状态：更简洁的提示
            <ConversationEmptyState
              description="选择 Agent 开始智能对话"
              icon={<MessageSquareIcon className="w-10 h-10 opacity-40" />}
              title="开始对话"
              className="mt-20"
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}