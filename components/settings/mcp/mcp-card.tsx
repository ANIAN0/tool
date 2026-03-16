/**
 * MCP服务器卡片组件
 * 展示单个MCP服务器的信息和操作按钮
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Server,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { McpServer, McpStatus } from "@/lib/db/schema";

/**
 * MCP卡片组件属性
 */
interface McpCardProps {
  // MCP服务器数据
  server: McpServer;
  // 当前状态检查结果
  statusResult?: {
    status: McpStatus;
    error?: string;
    responseTime?: number;
  };
  // 正在检查状态
  isCheckingStatus?: boolean;
  // 编辑回调
  onEdit: (server: McpServer) => void;
  // 删除回调
  onDelete: (id: string) => void;
  // 启用状态切换回调
  onToggleEnabled: (id: string, enabled: boolean) => void;
  // 检查状态回调
  onCheckStatus: (id: string) => void;
}

/**
 * 获取状态对应的徽章样式
 * @param status - 服务器状态
 */
function getStatusBadge(status: McpStatus) {
  switch (status) {
    case "online":
      return {
        variant: "default" as const,
        className: "bg-green-500 hover:bg-green-600",
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        label: "在线",
      };
    case "offline":
      return {
        variant: "secondary" as const,
        className: "bg-gray-500 hover:bg-gray-600 text-white",
        icon: <PowerOff className="h-3 w-3 mr-1" />,
        label: "离线",
      };
    case "error":
      return {
        variant: "destructive" as const,
        className: "",
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: "错误",
      };
    default:
      return {
        variant: "outline" as const,
        className: "",
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
        label: "未知",
      };
  }
}

/**
 * 脱敏显示URL
 * @param url - 原始URL
 */
function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // 隐藏路径和查询参数，只显示协议、主机和端口
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${port}/...`;
  } catch {
    // URL解析失败时显示部分字符
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
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * MCP服务器卡片组件
 */
export function McpCard({
  server,
  statusResult,
  isCheckingStatus = false,
  onEdit,
  onDelete,
  onToggleEnabled,
  onCheckStatus,
}: McpCardProps) {
  // 删除确认对话框状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 处理删除确认
  const handleDeleteConfirm = () => {
    onDelete(server.id);
    setShowDeleteDialog(false);
  };

  // 获取状态徽章配置
  const statusBadge = getStatusBadge(statusResult?.status || server.status);

  // 判断是否在线
  const isOnline = (statusResult?.status || server.status) === "online";

  return (
    <>
      <Card className={!server.is_enabled ? "opacity-60" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{server.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {maskUrl(server.url)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 启用开关 */}
              <Switch
                checked={server.is_enabled}
                onCheckedChange={(checked) => onToggleEnabled(server.id, checked)}
                aria-label={server.is_enabled ? "禁用服务器" : "启用服务器"}
              />

              {/* 操作菜单 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(server)}>
                    <Edit className="mr-2 h-4 w-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onCheckStatus(server.id)}
                    disabled={isCheckingStatus || !server.is_enabled}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    {isCheckingStatus ? "检查中..." : "检查状态"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* 状态徽章 */}
            <Badge variant={statusBadge.variant} className={statusBadge.className}>
              {statusBadge.icon}
              {statusBadge.label}
            </Badge>

            {/* 响应时间（仅在线时显示） */}
            {isOnline && statusResult?.responseTime && (
              <Badge variant="outline" className="text-xs">
                {statusResult.responseTime}ms
              </Badge>
            )}

            {/* 启用状态 */}
            <Badge variant={server.is_enabled ? "outline" : "secondary"} className="text-xs">
              {server.is_enabled ? "已启用" : "已禁用"}
            </Badge>
          </div>

          {/* 错误信息 */}
          {statusResult?.error && (
            <div className="mt-3 text-sm text-destructive flex items-start gap-1.5">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{statusResult.error}</span>
            </div>
          )}

          {/* 最后检查时间 */}
          {server.last_check_at && (
            <p className="mt-3 text-xs text-muted-foreground">
              最后检查：{formatDate(server.last_check_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除MCP服务器「{server.name}」吗？
              此操作不可撤销，服务器配置将永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
