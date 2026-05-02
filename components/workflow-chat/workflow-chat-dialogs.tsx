"use client";

/**
 * WorkflowChat 对话框组件
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
import { useWorkflowChatContext } from "./workflow-chat-context";

/**
 * WorkflowChatDialogs 组件
 * 管理删除确认和编辑确认两个对话框
 */
export function WorkflowChatDialogs() {
  const { actions, meta } = useWorkflowChatContext();

  return (
    <>
      {/* 删除确认对话框：删除会话 */}
      <Dialog
        open={meta.deleteDialogOpen}
        onOpenChange={(open) => {
          if (meta.isDeleting && !open) return;
          if (!open) {
            actions.closeDeleteDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除此会话将同时删除所有消息记录，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => actions.closeDeleteDialog()}
              disabled={meta.isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => actions.handleConfirmDelete()}
              disabled={meta.isDeleting}
            >
              {meta.isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑确认对话框：编辑消息 */}
      <Dialog
        open={meta.editDialogOpen}
        onOpenChange={(open) => {
          if (meta.isEditing && !open) return;
          if (!open) {
            actions.closeEditDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑消息</DialogTitle>
            <DialogDescription>
              编辑消息将删除该消息及后续所有回复，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => actions.closeEditDialog()}
              disabled={meta.isEditing}
            >
              取消
            </Button>
            <Button
              onClick={() => actions.handleConfirmEdit()}
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