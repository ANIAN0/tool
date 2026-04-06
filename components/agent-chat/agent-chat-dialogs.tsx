"use client";

/**
 * AgentChat对话框组件
 * 包含删除确认和编辑确认对话框
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAgentChatContext } from "./agent-chat-context";

/**
 * AgentChatDialogs组件
 * 管理删除确认和编辑确认两个对话框
 */
export function AgentChatDialogs() {
  // 从 Context 获取状态、操作和元数据
  const { actions, meta } = useAgentChatContext();

  return (
    <>
      {/* 删除确认对话框 */}
      <Dialog
        open={meta.deleteDialogOpen}
        onOpenChange={(open) => {
          // 如果正在删除，禁止关闭对话框（防止状态不一致）
          if (meta.isDeleting && !open) return;
          // 对话框关闭时调用 closeDeleteDialog
          if (!open) {
            actions.closeDeleteDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除此消息将同时删除后续所有消息，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {/* 取消按钮 */}
            <Button
              variant="outline"
              onClick={() => actions.closeDeleteDialog()}
              disabled={meta.isDeleting}
            >
              取消
            </Button>
            {/* 确认删除按钮 */}
            <Button
              variant="destructive"
              onClick={actions.handleConfirmDelete}
              disabled={meta.isDeleting}
            >
              {meta.isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑消息确认对话框 */}
      <Dialog
        open={meta.editDialogOpen}
        onOpenChange={(open) => {
          // 如果正在编辑，禁止关闭对话框（防止状态不一致）
          if (meta.isEditing && !open) return;
          // 对话框关闭时调用 closeEditDialog
          if (!open) {
            actions.closeEditDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑消息</DialogTitle>
            <DialogDescription>
              编辑消息将删除原消息及后续所有回复，原消息内容将填入输入框供您修改后重新发送。是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {/* 取消按钮 */}
            <Button
              variant="outline"
              onClick={() => actions.closeEditDialog()}
              disabled={meta.isEditing}
            >
              取消
            </Button>
            {/* 确认编辑按钮 */}
            <Button
              onClick={actions.handleConfirmEdit}
              disabled={meta.isEditing}
            >
              {meta.isEditing ? "处理中..." : "确认编辑"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}