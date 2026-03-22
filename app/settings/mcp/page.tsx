/**
 * MCP服务器管理页面
 * 用户可以管理自己的 MCP 服务器配置
 */

"use client";

import { useMcpServers, useMcpServersPolling } from "@/lib/hooks/use-mcp-servers";
import { useAuth } from "@/lib/hooks/use-auth";
import { McpList } from "@/components/settings/mcp/mcp-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { McpFormData } from "@/components/settings/mcp/mcp-form";

/**
 * MCP管理页面组件
 */
export default function McpSettingsPage() {
  // 获取认证信息
  const { getAuthHeader } = useAuth();
  // 获取MCP服务器列表和操作函数
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

  /**
   * 处理创建服务器
   * @param data - 表单数据
   */
  const handleCreate = async (data: McpFormData) => {
    // 创建服务器并获取返回的服务器对象
    const server = await createServer({
      name: data.name,
      url: data.url,
    });

    // 创建成功后立即检查状态，触发工具同步
    if (server?.id) {
      try {
        const response = await fetch(`/api/mcp/${server.id}/status`, {
          headers: {
            ...getAuthHeader(),
          },
        });
        const statusData = await response.json();

        // 更新本地状态
        updateServerStatus(server.id, statusData.status, statusData.error);
      } catch {
        updateServerStatus(server.id, "error", "检查状态失败");
      }
    }
  };

  /**
   * 处理更新服务器
   * @param id - 服务器ID
   * @param data - 表单数据
   */
  const handleUpdate = async (id: string, data: McpFormData) => {
    await updateServer(id, {
      name: data.name,
      url: data.url,
    });
  };

  /**
   * 处理删除服务器
   * @param id - 服务器ID
   */
  const handleDelete = async (id: string) => {
    await deleteServer(id);
  };

  /**
   * 处理启用状态切换
   * @param id - 服务器ID
   * @param enabled - 是否启用
   */
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await updateServer(id, { isEnabled: enabled });
  };

  /**
   * 处理检查服务器状态
   * @param id - 服务器ID
   */
  const handleCheckStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/mcp/${id}/status`, {
        headers: {
          ...getAuthHeader(),
        },
      });
      const data = await response.json();

      // 更新本地状态
      updateServerStatus(id, data.status, data.error);
    } catch {
      updateServerStatus(id, "error", "检查状态失败");
    }
  };

  /**
   * 清除错误信息
   */
  const handleClearError = () => {
    // 错误信息会在下次操作时自动清除
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MCP 服务器管理</h1>
        <p className="text-muted-foreground mt-1">
          管理您的 MCP (Model Context Protocol) 服务器连接，添加外部工具支持
        </p>
      </div>

      {/* 信息提示 */}
      <Alert variant="default" className="bg-muted">
        <Info className="h-4 w-4" />
        <AlertTitle>关于 MCP</AlertTitle>
        <AlertDescription>
          MCP (Model Context Protocol) 是一种开放协议，允许AI助手通过标准化的方式
          使用外部工具和服务。添加MCP服务器后，系统会自动获取该服务器提供的工具列表。
        </AlertDescription>
      </Alert>

      {/* MCP服务器列表 */}
      <McpList
        servers={servers}
        serverStatuses={serverStatuses}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchServers}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onToggleEnabled={handleToggleEnabled}
        onCheckStatus={handleCheckStatus}
        onClearError={handleClearError}
      />
    </div>
  );
}
