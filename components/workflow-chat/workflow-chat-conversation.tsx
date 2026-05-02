"use client";

/**
 * WorkflowChat 消息列表区域组件
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
import { MessageActions, type WorkflowChatMessageMetadata } from "./message-actions";
import { useWorkflowChatContext } from "./workflow-chat-context";
import { MessageSquareIcon, AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function isStepStartPart(part: { type: string }): boolean {
  return part.type === "step-start";
}

export function WorkflowChatConversation() {
  const { state, actions, meta } = useWorkflowChatContext();

  return (
    <div className="flex-1 overflow-hidden">
      <Conversation className="h-full">
        <ConversationContent className="px-8 py-8">
          {state.messages.length > 0 ? (
            state.messages.map((message, index) => {
              const messageMetadata = message.metadata as WorkflowChatMessageMetadata | undefined;
              const canDelete = meta.latestCheckpointIndex === -1 || index > meta.latestCheckpointIndex;

              return (
                <div key={message.id}>
                  <div className="group relative mb-6">
                    <Message from={message.role}>
                      <MessageContent className="max-w-4xl">
                        {message.parts.map((part, partIndex) => {
                          if (part.type === "text") {
                            return (
                              <MessageResponse key={partIndex}>
                                {part.text}
                              </MessageResponse>
                            );
                          }

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
            <ConversationEmptyState
              description="选择 Agent 开始智能对话"
              icon={<MessageSquareIcon className="w-10 h-10 opacity-40" />}
              title="开始对话"
              className="mt-20"
            />
          )}

          {state.error && (
            <div className="flex items-center gap-3 p-4 mt-4 rounded-lg bg-destructive/10 border border-destructive/20 max-w-4xl mx-auto">
              <AlertCircleIcon className="w-5 h-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm text-destructive font-medium">发送失败</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {state.error.message || "请检查网络连接后重试"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.reload()}
                className="flex items-center gap-2"
              >
                <RefreshCwIcon className="w-4 h-4" />
                重试
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}
