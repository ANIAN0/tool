/**
 * 工具详情弹窗组件
 * 展示工具的详细信息，包括描述、参数schema等
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plug, Wrench, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { Tool } from "@/lib/db/schema";
import { getToolIcon } from "@/lib/hooks/use-tools";

/**
 * 工具详情弹窗组件属性
 */
interface ToolDetailDialogProps {
  // 是否打开
  open: boolean;
  // 关闭回调
  onOpenChange: (open: boolean) => void;
  // 工具数据
  tool: Tool | null;
}

/**
 * 渲染JSON Schema为可读格式
 * @param schema - JSON Schema对象
 */
function renderJsonSchema(schema: Record<string, unknown>) {
  if (!schema || typeof schema !== "object") {
    return <p className="text-sm text-muted-foreground">无参数</p>;
  }

  const { properties, required = [] } = schema;

  if (!properties || typeof properties !== "object") {
    return <p className="text-sm text-muted-foreground">无参数</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(properties as Record<string, unknown>).map(([key, prop]) => {
        const isRequired = (required as string[]).includes(key);
        const propObj = prop as Record<string, unknown>;

        return (
          <div key={key} className="border rounded-md p-3">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-semibold bg-muted px-1.5 py-0.5 rounded">
                {key}
              </code>
              {isRequired && (
                <Badge variant="destructive" className="text-xs">必填</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {propObj.type as string || "any"}
              </span>
            </div>
            {!!propObj.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {propObj.description as string}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 获取状态徽章配置
 * @param tool - 工具对象
 */
function getStatusConfig(tool: Tool) {
  if (tool.source === "system") {
    return {
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      label: "系统内置",
      color: "bg-green-100 text-green-800 border-green-200",
    };
  }

  if (tool.isAvailable) {
    return {
      icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
      label: "可用",
      color: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }

  return {
    icon: <XCircle className="h-4 w-4 text-gray-500" />,
    label: "不可用",
    color: "bg-gray-100 text-gray-600 border-gray-200",
  };
}

/**
 * 工具详情弹窗组件
 */
export function ToolDetailDialog({
  open,
  onOpenChange,
  tool,
}: ToolDetailDialogProps) {
  // 如果没有工具数据，不渲染内容
  if (!tool) return null;

  const icon = getToolIcon(tool);
  const statusConfig = getStatusConfig(tool);
  const isMcpTool = tool.source === "mcp";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {/* 工具图标 */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-3xl">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl truncate">{tool.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {isMcpTool ? (
                  <span className="flex items-center text-sm">
                    <Plug className="h-3.5 w-3.5 mr-1.5" />
                    MCP 服务器：{tool.server?.name || "未知"}
                  </span>
                ) : (
                  <span className="flex items-center text-sm">
                    <Wrench className="h-3.5 w-3.5 mr-1.5" />
                    系统内置工具
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* 状态信息 */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusConfig.color}>
                <span className="flex items-center gap-1">
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </Badge>
              <Badge variant="outline">
                {isMcpTool ? "MCP 工具" : "系统工具"}
              </Badge>
            </div>

            <Separator />

            {/* 描述 */}
            <div>
              <h4 className="text-sm font-semibold mb-2">描述</h4>
              <p className="text-sm text-muted-foreground">
                {tool.description || "暂无描述"}
              </p>
            </div>

            <Separator />

            {/* 输入参数 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  输入参数
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderJsonSchema(tool.inputSchema)}
              </CardContent>
            </Card>

            {/* 来源详情（仅MCP工具） */}
            {isMcpTool && tool.server && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">来源详情</h4>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">服务器名称</span>
                      <span className="text-sm font-medium">{tool.server.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">服务器ID</span>
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                        {tool.server.id}
                      </code>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
