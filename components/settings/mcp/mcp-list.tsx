/**
 * MCP服务器列表组件
 * 展示所有MCP服务器并提供管理功能
 */

import { useState } from "react";
import { Plus, AlertCircle, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { McpCard } from "./mcp-card";
import { McpForm, type McpFormData } from "./mcp-form";
import type { McpServer, McpStatus } from "@/lib/db/schema";

/**
 * MCP列表组件属性
 */
interface McpListProps {
  // MCP服务器列表
  servers: McpServer[];
  // 服务器状态映射（由polling hook提供）
  serverStatuses: Record<string, {
    status: McpStatus;
    error?: string;
    responseTime?: number;
  }>;
  // 加载状态
  isLoading: boolean;
  // 错误信息
  error: string | null;
  // 刷新回调
  onRefresh: () => void;
  // 创建回调
  onCreate: (data: McpFormData) => Promise<void>;
  // 更新回调
  onUpdate: (id: string, data: McpFormData) => Promise<void>;
  // 删除回调
  onDelete: (id: string) => void;
  // 启用状态切换回调
  onToggleEnabled: (id: string, enabled: boolean) => void;
  // 检查状态回调
  onCheckStatus: (id: string) => void;
  // 清除错误回调
  onClearError: () => void;
}

/**
 * MCP服务器列表组件
 */
export function McpList({
  servers,
  serverStatuses,
  isLoading,
  error,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onToggleEnabled,
  onCheckStatus,
  onClearError,
}: McpListProps) {
  // 表单对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  // 正在编辑的服务器
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  // 提交中状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 表单错误
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * 打开添加表单
   */
  const handleAdd = () => {
    setEditingServer(null);
    setFormError(null);
    setIsFormOpen(true);
    onClearError();
  };

  /**
   * 打开编辑表单
   */
  const handleEdit = (server: McpServer) => {
    setEditingServer(server);
    setFormError(null);
    setIsFormOpen(true);
    onClearError();
  };

  /**
   * 关闭表单
   */
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingServer(null);
    setFormError(null);
  };

  /**
   * 提交表单
   */
  const handleSubmit = async (data: McpFormData) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingServer) {
        await onUpdate(editingServer.id, data);
      } else {
        await onCreate(data);
      }
      handleCloseForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">MCP服务器</h2>
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">MCP服务器</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            title="刷新"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          添加服务器
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 空状态 */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 py-12">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">还没有添加任何MCP服务器</p>
          <p className="text-sm text-muted-foreground mb-4">
            添加MCP服务器以使用外部工具
          </p>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加服务器
          </Button>
        </div>
      ) : (
        /* 服务器列表 */
        <div className="grid gap-4 md:grid-cols-2">
          {servers.map((server) => (
            <McpCard
              key={server.id}
              server={server}
              statusResult={serverStatuses[server.id]}
              isCheckingStatus={false}
              onEdit={handleEdit}
              onDelete={onDelete}
              onToggleEnabled={onToggleEnabled}
              onCheckStatus={onCheckStatus}
            />
          ))}
        </div>
      )}

      {/* 表单对话框 */}
      <McpForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        editingServer={editingServer}
        isSubmitting={isSubmitting}
        error={formError}
      />
    </div>
  );
}
