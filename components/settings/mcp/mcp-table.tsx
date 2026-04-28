/**
 * MCP 服务器表格组件
 * 表格布局展示 MCP 服务器列表
 */

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Server,
  CheckCircle2,
  XCircle,
  PowerOff,
  AlertCircle,
} from "lucide-react";
import type { McpServer, McpStatus } from "@/lib/schemas";

/**
 * MCP 表格组件属性
 */
interface McpTableProps {
  // MCP 服务器列表
  servers: McpServer[];
  // 服务器状态映射（由 polling hook 提供）
  serverStatuses: Record<
    string,
    {
      status: McpStatus;
      error?: string;
      responseTime?: number;
    }
  >;
  // 加载状态
  isLoading: boolean;
  // 错误信息
  error: string | null;
  // 刷新回调
  onRefresh: () => void;
  // 创建回调
  onCreate: () => void;
  // 查看详情回调
  onView: (serverId: string) => void;
  // 编辑回调
  onEdit: (server: McpServer) => void;
  // 删除回调
  onDelete: (serverId: string) => void;
  // 启用状态切换回调
  onToggleEnabled: (serverId: string, enabled: boolean) => void;
  // 检查状态回调
  onCheckStatus: (serverId: string) => void;
}

/**
 * 获取状态对应的徽章样式（柔和配色，与其他页面保持一致）
 * @param status - 服务器状态
 */
function getStatusBadge(status: McpStatus) {
  switch (status) {
    case "online":
      return {
        className: "bg-green-100 text-green-800",
        icon: <CheckCircle2 className="size-3 mr-1" />,
        label: "在线",
      };
    case "offline":
      return {
        className: "bg-gray-100 text-gray-600",
        icon: <PowerOff className="size-3 mr-1" />,
        label: "离线",
      };
    case "error":
      return {
        className: "bg-red-100 text-red-800",
        icon: <XCircle className="size-3 mr-1" />,
        label: "错误",
      };
    default:
      return {
        className: "bg-gray-100 text-gray-600",
        icon: <AlertCircle className="size-3 mr-1" />,
        label: "未知",
      };
  }
}

/**
 * 脱敏显示 URL
 * @param url - 原始 URL
 */
function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // 隐藏路径和查询参数，只显示协议、主机和端口
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${port}/...`;
  } catch {
    // URL 解析失败时显示部分字符
    if (url.length > 30) {
      return `${url.substring(0, 25)}...`;
    }
    return url;
  }
}

/**
 * 格式化日期
 * @param timestamp - 时间戳
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * MCP 服务器表格组件
 */
export function McpTable({
  servers,
  serverStatuses,
  isLoading,
  error,
  onRefresh,
  onCreate,
  onView,
  onEdit,
  onDelete,
  onToggleEnabled,
  onCheckStatus,
}: McpTableProps) {
  // 计算统计信息
  const stats = {
    total: servers.length,
    online: servers.filter((s) => (serverStatuses[s.id]?.status || s.status) === "online").length,
    offline: servers.filter((s) => (serverStatuses[s.id]?.status || s.status) === "offline").length,
    error: servers.filter((s) => (serverStatuses[s.id]?.status || s.status) === "error").length,
    enabled: servers.filter((s) => s.is_enabled).length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCP 服务器管理</h1>
          <p className="text-muted-foreground mt-1">管理您的 MCP 服务器连接，添加外部工具支持</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="size-4" />
          添加服务器
        </Button>
      </div>

      {/* 统计徽章 */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary">总数: {stats.total}</Badge>
        <Badge className="bg-green-100 text-green-800">在线: {stats.online}</Badge>
        <Badge variant="outline">离线: {stats.offline}</Badge>
        {stats.error > 0 && (
          <Badge className="bg-red-100 text-red-800">错误: {stats.error}</Badge>
        )}
        <Badge variant="outline">已启用: {stats.enabled}</Badge>
      </div>

      {/* 表格区域 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-[280px]">URL</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[100px]">响应时间</TableHead>
              <TableHead className="w-[80px]">启用</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 加载状态：骨架屏 */}
            {isLoading &&
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}

            {/* 空状态 */}
            {!isLoading && servers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <Server className="size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无 MCP 服务器，点击添加</p>
                    <Button variant="outline" onClick={onCreate}>
                      <Plus className="size-4" />
                      添加服务器
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 数据行 */}
            {!isLoading &&
              servers.map((server) => {
                // 获取服务器状态
                const statusResult = serverStatuses[server.id];
                const currentStatus = statusResult?.status || server.status;
                const statusBadge = getStatusBadge(currentStatus);
                const isOnline = currentStatus === "online";

                return (
                  <TableRow
                    key={server.id}
                    className={!server.is_enabled ? "opacity-60" : ""}
                  >
                    {/* 名称列 */}
                    <TableCell className="font-medium">{server.name}</TableCell>

                    {/* URL 列 */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {maskUrl(server.url)}
                    </TableCell>

                    {/* 状态列 */}
                    <TableCell>
                      <Badge className={statusBadge.className}>
                        {statusBadge.icon}
                        {statusBadge.label}
                      </Badge>
                    </TableCell>

                    {/* 响应时间列 */}
                    <TableCell className="text-muted-foreground">
                      {isOnline && statusResult?.responseTime
                        ? `${statusResult.responseTime}ms`
                        : "-"}
                    </TableCell>

                    {/* 启用状态列 */}
                    <TableCell>
                      <Switch
                        checked={server.is_enabled}
                        onCheckedChange={(checked) => onToggleEnabled(server.id, checked)}
                        aria-label={server.is_enabled ? "禁用服务器" : "启用服务器"}
                      />
                    </TableCell>

                    {/* 操作列 */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(server.id)}>
                            <Eye className="size-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(server)}>
                            <Edit className="size-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCheckStatus(server.id)}>
                            <RefreshCw className="size-4 mr-2" />
                            检查状态
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(server.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}