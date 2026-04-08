/**
 * MCP 服务器管理页面
 * 表格布局展示 MCP 服务器列表，详情通过右侧抽屉展示
 */

"use client";

import { useState, useCallback } from "react";
import { useMcpServers, useMcpServersPolling } from "@/lib/hooks/use-mcp-servers";
import { useAuth } from "@/lib/hooks/use-auth";
import { McpTable } from "@/components/settings/mcp/mcp-table";
import { McpSheet } from "@/components/settings/mcp/mcp-sheet";
import { McpFormDialog, type McpFormData } from "@/components/settings/mcp/mcp-form-dialog";
import type { McpServer } from "@/lib/db/schema";

/**
 * MCP 管理页面组件
 */
export default function McpSettingsPage() {
  // 获取认证信息
  const { getAuthHeader } = useAuth();
  // 获取 MCP 服务器列表和操作函数
  const {
    servers,
    isLoading,
    error,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    updateServerStatus,
  } = useMcpServers();

  // 自动轮询服务器状态（30秒间隔）
  const { serverStatuses } = useMcpServersPolling(servers, 30000);

  // 详情抽屉状态
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  // 表单对话框状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 处理查看服务器详情
   */
  const handleView = useCallback((serverId: string) => {
    setSelectedServerId(serverId);
    setSheetOpen(true);
  }, []);

  /**
   * 关闭详情抽屉
   */
  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
    setSelectedServerId(null);
  }, []);

  /**
   * 打开添加表单
   */
  const handleCreate = useCallback(() => {
    setEditingServer(null);
    setFormOpen(true);
  }, []);

  /**
   * 打开编辑表单
   */
  const handleEdit = useCallback((server: McpServer) => {
    setEditingServer(server);
    setFormOpen(true);
  }, []);

  /**
   * 关闭表单对话框
   */
  const handleCloseForm = useCallback(() => {
    setFormOpen(false);
    setEditingServer(null);
  }, []);

  /**
   * 处理表单提交
   */
  const handleFormSubmit = useCallback(
    async (data: McpFormData) => {
      setIsSubmitting(true);
      try {
        if (editingServer) {
          // 更新现有服务器
          await updateServer(editingServer.id, {
            name: data.name,
            url: data.url,
            headers: data.headers,
          });
        } else {
          // 创建新服务器
          const server = await createServer({
            name: data.name,
            url: data.url,
            headers: data.headers,
          });

          // 创建成功后在后台检查状态
          if (server?.id) {
            void (async () => {
              try {
                const response = await fetch(`/api/mcp/${server.id}/status`, {
                  headers: {
                    ...getAuthHeader(),
                  },
                });
                const statusData = await response.json();
                updateServerStatus(server.id, statusData.status, statusData.error);
              } catch {
                updateServerStatus(server.id, "error", "检查状态失败");
              }
            })();
          }
        }
        // 提交成功后关闭表单
        handleCloseForm();
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingServer, createServer, updateServer, getAuthHeader, updateServerStatus, handleCloseForm]
  );

  /**
   * 处理删除服务器
   */
  const handleDelete = useCallback(
    async (serverId: string) => {
      await deleteServer(serverId);
      // 如果删除的是当前查看的服务器，关闭抽屉
      if (selectedServerId === serverId) {
        handleCloseSheet();
      }
    },
    [deleteServer, selectedServerId, handleCloseSheet]
  );

  /**
   * 处理启用状态切换
   */
  const handleToggleEnabled = useCallback(
    async (serverId: string, enabled: boolean) => {
      await updateServer(serverId, { isEnabled: enabled });
    },
    [updateServer]
  );

  /**
   * 处理检查服务器状态
   */
  const handleCheckStatus = useCallback(
    async (serverId: string) => {
      try {
        const response = await fetch(`/api/mcp/${serverId}/status`, {
          headers: {
            ...getAuthHeader(),
          },
        });
        const data = await response.json();

        // 更新本地状态
        updateServerStatus(serverId, data.status, data.error);
      } catch {
        updateServerStatus(serverId, "error", "检查状态失败");
      }
    },
    [getAuthHeader, updateServerStatus]
  );

  return (
    <>
      {/* MCP 表格组件 */}
      <McpTable
        servers={servers}
        serverStatuses={serverStatuses}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchServers}
        onCreate={handleCreate}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleEnabled={handleToggleEnabled}
        onCheckStatus={handleCheckStatus}
      />

      {/* MCP 详情抽屉 */}
      <McpSheet
        serverId={selectedServerId}
        open={sheetOpen}
        onClose={handleCloseSheet}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* 新增/编辑表单对话框 */}
      <McpFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        editingServer={editingServer}
        isSubmitting={isSubmitting}
      />
    </>
  );
}