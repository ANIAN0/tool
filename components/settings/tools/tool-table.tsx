/**
 * 工具表格组件
 * 表格布局展示工具列表，详情通过右侧抽屉展示
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  Wrench,
  Plug,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Tool } from "@/lib/schemas";

/**
 * 工具表格组件属性
 */
interface ToolTableProps {
  // 工具列表
  tools: Tool[];
  // 加载状态
  isLoading: boolean;
  // 错误信息
  error: string | null;
  // 统计信息
  stats?: {
    total: number;
    system: number;
    mcp: number;
    available: number;
  } | null;
  // 刷新回调
  onRefresh: () => void;
  // 查看详情回调
  onViewDetail: (tool: Tool) => void;
}

/**
 * 工具表格组件
 */
export function ToolTable({
  tools,
  isLoading,
  error,
  stats,
  onRefresh,
  onViewDetail,
}: ToolTableProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">工具管理</h1>
          <p className="text-muted-foreground mt-1">
            查看可用的AI工具，包括系统内置工具和MCP外部工具
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          title="刷新"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">总计：{stats.total}</Badge>
          <Badge variant="outline">系统：{stats.system}</Badge>
          <Badge variant="outline">MCP：{stats.mcp}</Badge>
          <Badge variant="outline">可用：{stats.available}</Badge>
        </div>
      )}

      {/* 表格区域 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-[200px]">描述</TableHead>
              <TableHead className="w-[80px]">来源</TableHead>
              <TableHead className="w-[80px]">状态</TableHead>
              <TableHead className="w-[120px]">服务器</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 加载状态：骨架屏 */}
            {isLoading &&
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}

            {/* 错误状态 */}
            {!isLoading && error && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">{error}</p>
                    <Button variant="outline" onClick={onRefresh}>
                      重试
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 空状态 */}
            {!isLoading && !error && tools.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <Wrench className="size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无工具</p>
                    <p className="text-sm text-muted-foreground">
                      系统工具将自动加载
                    </p>
                    <Button variant="outline" onClick={onRefresh}>
                      <RefreshCw className="mr-2 size-4" />
                      刷新
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 数据行 */}
            {!isLoading &&
              !error &&
              tools.map((tool) => (
                <TableRow key={tool.id} className="hover:bg-muted/50">
                  {/* 名称列 */}
                  <TableCell className="font-medium">{tool.name}</TableCell>

                  {/* 描述列 */}
                  <TableCell className="truncate max-w-[200px] text-muted-foreground">
                    {tool.description || "-"}
                  </TableCell>

                  {/* 来源列 */}
                  <TableCell>
                    {tool.source === "system" ? (
                      <Badge variant="secondary">
                        <Wrench className="mr-1 h-3 w-3" />
                        系统
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        <Plug className="mr-1 h-3 w-3" />
                        MCP
                      </Badge>
                    )}
                  </TableCell>

                  {/* 状态列 */}
                  <TableCell>
                    {tool.isAvailable ? (
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
                  </TableCell>

                  {/* 服务器列 */}
                  <TableCell className="text-muted-foreground">
                    {tool.source === "mcp" && tool.server?.name
                      ? tool.server.name
                      : "-"}
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
                        <DropdownMenuItem onClick={() => onViewDetail(tool)}>
                          <Eye className="size-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}