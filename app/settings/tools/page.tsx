/**
 * 工具管理页面
 * 展示所有可用的系统工具和MCP工具
 */

"use client";

import { useTools } from "@/lib/hooks/use-tools";
import { ToolList } from "@/components/settings/tools/tool-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工具管理</h1>
        <p className="text-muted-foreground mt-1">
          查看和管理可用的AI工具，包括系统内置工具和通过MCP服务器连接的外部工具
        </p>
      </div>

      {/* 信息提示 */}
      <Alert variant="default" className="bg-muted">
        <Info className="h-4 w-4" />
        <AlertTitle>关于工具</AlertTitle>
        <AlertDescription>
          工具是AI助手可以调用的功能，用于执行特定任务。
          系统工具是内置功能，MCP工具来自外部服务器。
          在对话中，AI会自动选择合适的工具来响应您的请求。
        </AlertDescription>
      </Alert>

      {/* 工具列表 */}
      <ToolList
        tools={tools}
        isLoading={isLoading}
        error={error}
        stats={stats}
        onRefresh={fetchTools}
      />
    </div>
  );
}
