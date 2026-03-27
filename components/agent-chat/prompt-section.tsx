"use client";

/**
 * 消息输入组件
 * 使用AI Elements的PromptInput和Attachments系列组件构建输入区
 * 功能点17：消息输入组件
 * 功能点23：支持发送消息状态
 */

import {
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputHeader,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChatStatus } from "ai";
import { PaperclipIcon } from "lucide-react";

/**
 * PromptSection组件的Props
 */
interface PromptSectionProps {
  // 提交回调
  onSubmit: (message: { text: string }) => void | Promise<void>;
  // 聊天状态
  status?: ChatStatus;
  // 停止生成回调
  onStop?: () => void;
  // 占位符文本
  placeholder?: string;
}

/**
 * 消息输入组件
 * 支持文本输入、发送/停止按钮
 */
export function PromptSection({
  onSubmit,
  status = "ready",
  onStop,
  placeholder = "输入消息，按 Enter 发送...",
}: PromptSectionProps) {
  // 是否正在生成
  const isGenerating = status === "submitted" || status === "streaming";

  return (
    <TooltipProvider>
      <div className="shrink-0 border-t border-border p-4">
        <PromptInput
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md"
          maxFiles={5}
          maxFileSize={10 * 1024 * 1024}
          multiple
          onSubmit={onSubmit}
        >
          {/* 附件预览区域 */}
          <PromptInputHeader>
            <Attachments variant="inline">
              <AttachmentList />
            </Attachments>
          </PromptInputHeader>

          {/* 文本输入区域 */}
          <PromptInputTextarea
            disabled={isGenerating}
            placeholder={placeholder}
          />

          {/* 底部工具栏 */}
          <PromptInputFooter>
            {/* 左侧工具按钮 */}
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger
                  disabled={isGenerating}
                  tooltip={{
                    content: "添加附件",
                    side: "top",
                  }}
                >
                  <PaperclipIcon className="size-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments label="上传图片或文件" />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>

            {/* 右侧发送/停止按钮 */}
            <PromptInputSubmit
              onStop={onStop}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </TooltipProvider>
  );
}

/**
 * 附件列表组件
 */
function AttachmentList() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <>
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </>
  );
}
