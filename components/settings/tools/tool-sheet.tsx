/**
 * 工具详情抽屉组件
 * 展示工具的详细信息，包括描述、参数schema等
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plug,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Server,
  FileText,
} from "lucide-react";
import type { Tool } from "@/lib/schemas";

/**
 * 工具详情抽屉组件属性
 */
interface ToolSheetProps {
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
function renderJsonSchema(schema: Record<string, unknown> | null) {
  if (!schema || typeof schema !== "object") {
    return (
      <div className="bg-muted/30 rounded-lg border p-4 text-center text-muted-foreground text-sm">
        无参数定义
      </div>
    );
  }

  const { properties, required = [] } = schema;

  if (!properties || typeof properties !== "object") {
    return (
      <div className="bg-muted/30 rounded-lg border p-4 text-center text-muted-foreground text-sm">
        无参数定义
      </div>
    );
  }

  const entries = Object.entries(properties as Record<string, unknown>);

  if (entries.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg border p-4 text-center text-muted-foreground text-sm">
        无参数定义
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([key, prop]) => {
        const isRequired = (required as string[]).includes(key);
        const propObj = prop as Record<string, unknown>;

        return (
          <div
            key={key}
            className="bg-muted/30 rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <code className="text-sm font-medium">{key}</code>
              <span className="text-xs text-muted-foreground">
                {propObj.type as string || "any"}
              </span>
              {isRequired && (
                <Badge variant="destructive" className="text-xs h-5">
                  必填
                </Badge>
              )}
            </div>
            {typeof propObj.description === "string" && (
              <p className="text-xs text-muted-foreground">
                {propObj.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 工具详情抽屉组件
 */
export function ToolSheet({
  open,
  onOpenChange,
  tool,
}: ToolSheetProps) {
  // 如果没有工具数据，不渲染内容
  if (!tool) return null;

  const isMcpTool = tool.source === "mcp";
  const isAvailable = tool.isAvailable;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        {/* 头部区域 */}
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="text-xl">{tool.name}</SheetTitle>
          <SheetDescription className="text-base">
            {isMcpTool ? (
              <span className="flex items-center">
                <Plug className="size-4 mr-1.5" />
                MCP 服务器：{tool.server?.name || "未知"}
              </span>
            ) : (
              <span className="flex items-center">
                <Wrench className="size-4 mr-1.5" />
                系统内置工具
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* 内容区域 */}
        <ScrollArea className="flex-1 px-6">
          <div className="flex flex-col gap-6 py-6">
            {/* 状态信息 */}
            <div className="flex flex-wrap items-center gap-2">
              {isAvailable ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  可用
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  <XCircle className="mr-1 h-3 w-3" />
                  不可用
                </Badge>
              )}
              {isMcpTool ? (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <Plug className="mr-1 h-3 w-3" />
                  MCP 工具
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Wrench className="mr-1 h-3 w-3" />
                  系统工具
                </Badge>
              )}
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 来源类型 */}
              <div className="bg-muted/40 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  {isMcpTool ? <Server className="size-3" /> : <Wrench className="size-3" />}
                  <span>来源类型</span>
                </div>
                <div className="text-sm font-medium">
                  {isMcpTool ? "MCP 服务器" : "系统内置"}
                </div>
              </div>
              {/* 可用状态 */}
              <div className="bg-muted/40 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  {isAvailable ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                  <span>可用状态</span>
                </div>
                <div className="text-sm font-medium">
                  {isAvailable ? "可用" : "不可用"}
                </div>
              </div>
              {/* 服务器名称（仅MCP工具） */}
              {isMcpTool && tool.server && (
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Server className="size-3" />
                    <span>服务器名称</span>
                  </div>
                  <div className="text-sm font-medium truncate">{tool.server.name}</div>
                </div>
              )}
              {/* 工具ID */}
              <div className="bg-muted/40 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <FileText className="size-3" />
                  <span>工具ID</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {tool.id}
                </div>
              </div>
            </div>

            {/* 描述区块 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">描述</span>
              </div>
              <div className="bg-muted/30 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  {tool.description || "暂无描述"}
                </p>
              </div>
            </div>

            {/* 输入参数区块 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">输入参数</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {tool.inputSchema?.properties
                    ? Object.keys(tool.inputSchema.properties).length
                    : 0} 个参数
                </span>
              </div>
              {renderJsonSchema(tool.inputSchema)}
            </div>

            {/* 服务器详情（仅MCP工具） */}
            {isMcpTool && tool.server && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Server className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">服务器详情</span>
                </div>
                <div className="bg-muted/30 rounded-lg border p-4 space-y-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">服务器名称</span>
                    <span className="text-sm font-medium truncate">{tool.server.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">服务器ID</span>
                    <code className="text-xs bg-background px-1.5 py-0.5 rounded truncate">
                      {tool.server.id}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}