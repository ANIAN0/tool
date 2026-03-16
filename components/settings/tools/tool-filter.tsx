/**
 * 工具筛选组件
 * 提供按来源、可用性和搜索关键词筛选工具的功能
 */

import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ToolFilter } from "@/lib/hooks/use-tools";

/**
 * 工具筛选组件属性
 */
interface ToolFilterProps {
  // 当前筛选条件
  filter: ToolFilter;
  // 筛选条件变更回调
  onFilterChange: (filter: ToolFilter) => void;
  // 统计信息
  stats?: {
    total: number;
    system: number;
    mcp: number;
    available: number;
  } | null;
}

/**
 * 工具筛选组件
 */
export function ToolFilterBar({
  filter,
  onFilterChange,
  stats,
}: ToolFilterProps) {
  /**
   * 更新单个筛选条件
   */
  const updateFilter = (key: keyof ToolFilter, value: string) => {
    onFilterChange({
      ...filter,
      [key]: value,
    });
  };

  /**
   * 清除所有筛选条件
   */
  const clearFilters = () => {
    onFilterChange({
      source: "all",
      availability: "all",
      searchQuery: "",
    });
  };

  /**
   * 是否有激活的筛选条件
   */
  const hasActiveFilters =
    filter.source !== "all" ||
    filter.availability !== "all" ||
    (filter.searchQuery && filter.searchQuery.trim() !== "");

  return (
    <div className="space-y-4">
      {/* 搜索和筛选行 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 搜索输入框 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工具名称或描述..."
            value={filter.searchQuery || ""}
            onChange={(e) => updateFilter("searchQuery", e.target.value)}
            className="pl-9"
          />
          {filter.searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => updateFilter("searchQuery", "")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* 来源筛选 */}
        <Select
          value={filter.source || "all"}
          onValueChange={(value) => updateFilter("source", value)}
        >
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="system">系统工具</SelectItem>
            <SelectItem value="mcp">MCP 工具</SelectItem>
          </SelectContent>
        </Select>

        {/* 可用性筛选 */}
        <Select
          value={filter.availability || "all"}
          onValueChange={(value) => updateFilter("availability", value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="可用性" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="available">可用</SelectItem>
            <SelectItem value="unavailable">不可用</SelectItem>
          </SelectContent>
        </Select>

        {/* 清除筛选按钮 */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            <X className="mr-1 h-4 w-4" />
            清除筛选
          </Button>
        )}
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            总计：{stats.total}
          </Badge>
          <Badge variant="outline" className="text-xs bg-green-50">
            系统：{stats.system}
          </Badge>
          <Badge variant="outline" className="text-xs bg-blue-50">
            MCP：{stats.mcp}
          </Badge>
          <Badge variant="outline" className="text-xs">
            可用：{stats.available}
          </Badge>
        </div>
      )}
    </div>
  );
}
