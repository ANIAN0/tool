/**
 * 工具管理页面
 * 表格布局展示工具列表，详情通过右侧抽屉展示
 */

"use client";

import { useState, useCallback } from "react";
import { useTools } from "@/lib/hooks/use-tools";
import { ToolTable } from "@/components/settings/tools/tool-table";
import { ToolSheet } from "@/components/settings/tools/tool-sheet";
import type { Tool } from "@/lib/db/schema";

/**
 * 工具管理页面组件
 */
export default function ToolsSettingsPage() {
  // 获取工具列表和相关操作
  const {
    tools,
    stats,
    isLoading,
    error,
    fetchTools,
  } = useTools();

  // 详情抽屉状态
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  /**
   * 处理查看工具详情
   * @param tool - 工具对象
   */
  const handleViewDetail = useCallback((tool: Tool) => {
    setSelectedTool(tool);
    setSheetOpen(true);
  }, []);

  return (
    <>
      {/* 工具表格 */}
      <ToolTable
        tools={tools}
        isLoading={isLoading}
        error={error}
        stats={stats}
        onRefresh={fetchTools}
        onViewDetail={handleViewDetail}
      />

      {/* 详情抽屉 */}
      <ToolSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tool={selectedTool}
      />
    </>
  );
}