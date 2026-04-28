/**
 * MCP 服务器详情抽屉组件
 * 展示 MCP 服务器的详细信息和操作
 */

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  Calendar,
  Clock,
  Server,
  Globe,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PowerOff,
  Edit,
  Trash2,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";
import type { McpServer, McpStatus } from "@/lib/schemas";

/**
 * MCP 服务器详情数据类型
 */
interface McpServerDetail extends McpServer {
  tools?: Array<{
    name: string;
    description?: string;
  }>;
  lastError?: string | null;
}

/**
 * MCP 详情抽屉组件属性
 */
interface McpSheetProps {
  // 服务器 ID（null 表示关闭）
  serverId: string | null;
  // 是否打开
  open: boolean;
  // 关闭回调
  onClose: () => void;
  // 编辑回调
  onEdit: (server: McpServer) => void;
  // 删除回调
  onDelete: (serverId: string) => void;
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
 * 格式化日期时间
 * @param timestamp - 时间戳
 */
function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return "从未";
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * MCP 服务器详情抽屉组件
 */
export function McpSheet({ serverId, open, onClose, onEdit, onDelete }: McpSheetProps) {
  // 服务器详情数据
  const [serverDetail, setServerDetail] = useState<McpServerDetail | null>(null);
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 复制状态
  const [copied, setCopied] = useState(false);
  // 删除确认对话框
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 加载服务器详情
  useEffect(() => {
    if (serverId && open) {
      loadServerDetail(serverId);
    }
  }, [serverId, open]);

  /**
   * 加载服务器详情
   */
  const loadServerDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    setServerDetail(null);

    try {
      const response = await authenticatedFetch(`/api/mcp/${id}`);
      if (response.ok) {
        const data = await response.json();
        setServerDetail(data);
      } else {
        setError("加载详情失败");
      }
    } catch (err) {
      console.error("加载 MCP 详情失败:", err);
      setError("加载详情失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  /**
   * 重试加载详情
   */
  const retryLoadDetail = () => {
    if (serverId) {
      loadServerDetail(serverId);
    }
  };

  /**
   * 复制 API 示例代码
   */
  const copyApiExample = async () => {
    if (!serverDetail) return;

    const apiExample = `curl -X POST "https://your-domain/api/mcp/${serverDetail.id}/tools" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "tool_name", "arguments": {...}}'`;

    try {
      await navigator.clipboard.writeText(apiExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  /**
   * 处理编辑
   */
  const handleEdit = () => {
    if (serverDetail) {
      onEdit(serverDetail);
      onClose();
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = () => {
    if (serverDetail) {
      onDelete(serverDetail.id);
      setShowDeleteDialog(false);
      onClose();
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          {/* 头部区域 */}
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="text-xl">
              {loading ? "加载中..." : serverDetail?.name ?? "MCP 服务器详情"}
            </SheetTitle>
            <SheetDescription className="text-base">
              {loading ? "正在获取详情信息" : serverDetail?.url ?? ""}
            </SheetDescription>
          </SheetHeader>

          {/* 内容区域 */}
          <ScrollArea className="flex-1 px-6">
            {/* 加载状态 */}
            {loading && (
              <div className="flex flex-col gap-6 py-6">
                {/* 统计卡片骨架 */}
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-muted/40 rounded-lg p-4">
                      <Skeleton className="h-3 w-16 mb-2" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            )}

            {/* 错误状态 */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                  <RefreshCw className="size-5 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={retryLoadDetail}>
                  重试
                </Button>
              </div>
            )}

            {/* 详情内容 */}
            {!loading && !error && serverDetail && (
              <div className="flex flex-col gap-6 py-6">
                {/* 状态徽章区域 */}
                <div className="flex items-center gap-2">
                  {/* 状态徽章 */}
                  <Badge className={getStatusBadge(serverDetail.status).className}>
                    {getStatusBadge(serverDetail.status).icon}
                    {getStatusBadge(serverDetail.status).label}
                  </Badge>

                  {/* 启用状态徽章 */}
                  <Badge variant={serverDetail.is_enabled ? "outline" : "secondary"}>
                    {serverDetail.is_enabled ? "已启用" : "已禁用"}
                  </Badge>
                </div>

                {/* 统计卡片 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Calendar className="size-3" />
                      <span>创建时间</span>
                    </div>
                    <div className="text-sm font-medium">
                      {formatDateTime(serverDetail.created_at)}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Calendar className="size-3" />
                      <span>更新时间</span>
                    </div>
                    <div className="text-sm font-medium">
                      {formatDateTime(serverDetail.updated_at)}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Clock className="size-3" />
                      <span>最后检查</span>
                    </div>
                    <div className="text-sm font-medium">
                      {formatDateTime(serverDetail.last_check_at)}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Server className="size-3" />
                      <span>工具数量</span>
                    </div>
                    <div className="text-sm font-medium">
                      {serverDetail.tools?.length || 0} 个
                    </div>
                  </div>
                </div>

                {/* URL 信息区块 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">服务器 URL</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg border p-4">
                    <code className="text-xs font-mono text-muted-foreground break-all">
                      {serverDetail.url}
                    </code>
                  </div>
                </div>

                {/* Headers 配置区块 */}
                {serverDetail.headers && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="size-4 text-muted-foreground" />
                      <span className="font-medium text-sm">请求 Headers</span>
                    </div>
                    <div className="bg-muted/30 rounded-lg border p-4">
                      <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                        {JSON.stringify(JSON.parse(serverDetail.headers), null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 错误信息区块 */}
                {serverDetail.status === "error" && serverDetail.lastError && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="size-4 text-destructive" />
                      <span className="font-medium text-sm text-destructive">错误信息</span>
                    </div>
                    <div className="bg-destructive/10 rounded-lg border border-destructive/20 p-4">
                      <p className="text-sm text-destructive">{serverDetail.lastError}</p>
                    </div>
                  </div>
                )}

                {/* 工具列表区块 */}
                {serverDetail.tools && serverDetail.tools.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="size-4 text-muted-foreground" />
                      <span className="font-medium text-sm">工具列表</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {serverDetail.tools.length} 个工具
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {serverDetail.tools.map((tool, index) => (
                        <div
                          key={tool.name}
                          className="bg-muted/30 rounded-lg border border-transparent hover:border-border/50 transition-colors px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="size-7 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium mt-0.5">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{tool.name}</div>
                              {tool.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {tool.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* API 示例区块 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">API 调用示例</span>
                  </div>
                  <div className="relative bg-muted/30 rounded-lg border">
                    <pre className="text-xs p-4 overflow-x-auto">
                      <code className="text-muted-foreground whitespace-pre">{`curl -X POST "https://your-domain/api/mcp/${serverDetail.id}/tools" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "tool_name", "arguments": {...}}'`}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7"
                      onClick={copyApiExample}
                    >
                      {copied ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span className="text-xs text-emerald-600">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span className="text-xs">复制</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 操作按钮区域 */}
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={handleEdit}>
                    <Edit className="size-4 mr-2" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    删除
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除 MCP 服务器「{serverDetail?.name}」吗？
              此操作不可撤销，服务器配置将永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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