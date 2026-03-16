/**
 * 工具列表组件
 * 展示所有工具并提供筛选、查看详情功能
 */

import { useState, useCallback } from "react";
import { Wrench, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolCard } from "./tool-card";
import { ToolDetailDialog } from "./tool-detail-dialog";
import { ToolFilterBar } from "./tool-filter";
import type { Tool } from "@/lib/db/schema";
import type { ToolFilter } from "@/lib/hooks/use-tools";

/**
 * 工具列表组件属性
 */
interface ToolListProps {
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
}

/**
 * 工具列表组件
 */
export function ToolList({
  tools,
  isLoading,
  error,
  stats,
  onRefresh,
}: ToolListProps) {
  // 当前筛选条件
  const [filter, setFilter] = useState<ToolFilter>({
    source: "all",
    availability: "all",
    searchQuery: "",
  });

  // 选中的工具（用于详情弹窗）
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  // 详情弹窗开关
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  /**
   * 处理查看工具详情
   * @param tool - 工具对象
   */
  const handleViewDetail = useCallback((tool: Tool) => {
    setSelectedTool(tool);
    setIsDetailOpen(true);
  }, []);

  /**
   * 应用筛选后的工具列表
   */
  const filteredTools = tools.filter((tool) => {
    // 按来源筛选
    if (filter.source && filter.source !== "all") {
      if (tool.source !== filter.source) {
        return false;
      }
    }

    // 按可用性筛选
    if (filter.availability && filter.availability !== "all") {
      if (filter.availability === "available" && !tool.isAvailable) {
        return false;
      }
      if (filter.availability === "unavailable" && tool.isAvailable) {
        return false;
      }
    }

    // 按搜索关键词筛选
    if (filter.searchQuery && filter.searchQuery.trim() !== "") {
      const query = filter.searchQuery.toLowerCase().trim();
      const nameMatch = tool.name.toLowerCase().includes(query);
      const descMatch = tool.description?.toLowerCase().includes(query);
      if (!nameMatch && !descMatch) {
        return false;
      }
    }

    return true;
  });

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* 标题和刷新按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">可用工具</h2>
            <Skeleton className="h-10 w-10" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* 筛选栏骨架 */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-[140px]" />
          </div>
        </div>

        {/* 工具卡片骨架 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和刷新按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">可用工具</h2>
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
      </div>

      {/* 筛选栏 */}
      <ToolFilterBar
        filter={filter}
        onFilterChange={setFilter}
        stats={stats}
      />

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 工具列表 */}
      {filteredTools.length === 0 ? (
        /* 空状态 */
        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 py-16">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">
            {tools.length === 0 ? "暂无可用的工具" : "没有匹配的工具"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {tools.length === 0
              ? "系统工具将自动加载，添加MCP服务器以获取更多工具"
              : "尝试调整筛选条件"}
          </p>
          {tools.length === 0 && (
            <Button onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
          )}
        </div>
      ) : (
        /* 工具卡片网格 */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onViewDetail={handleViewDetail}
            />
          ))}
        </div>
      )}

      {/* 详情弹窗 */}
      <ToolDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        tool={selectedTool}
      />
    </div>
  );
}
