/**
 * 工具卡片组件
 * 展示单个工具的信息
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Plug, Wrench } from "lucide-react";
import type { Tool } from "@/lib/db/schema";
import { getToolIcon, getToolStatusLabel } from "@/lib/hooks/use-tools";

/**
 * 工具卡片组件属性
 */
interface ToolCardProps {
  // 工具数据
  tool: Tool;
  // 点击查看详情回调
  onViewDetail: (tool: Tool) => void;
}

/**
 * 工具卡片组件
 */
export function ToolCard({ tool, onViewDetail }: ToolCardProps) {
  // 获取工具图标
  const icon = getToolIcon(tool);
  // 获取工具状态标签
  const statusLabel = getToolStatusLabel(tool);

  // 判断是否为MCP工具
  const isMcpTool = tool.source === "mcp";

  return (
    <Card className={!tool.isAvailable ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* 工具图标 */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">
              {icon}
            </div>

            {/* 工具名称和来源 */}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{tool.name}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {/* 来源标识 */}
                {isMcpTool ? (
                  <span className="flex items-center text-xs text-muted-foreground">
                    <Plug className="h-3 w-3 mr-1" />
                    {tool.server?.name || "MCP"}
                  </span>
                ) : (
                  <span className="flex items-center text-xs text-muted-foreground">
                    <Wrench className="h-3 w-3 mr-1" />
                    系统
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 状态标签 */}
          <Badge className={statusLabel.color} variant="outline">
            {statusLabel.text}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 工具描述 */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {tool.description || "暂无描述"}
        </p>

        {/* 操作按钮 */}
        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetail(tool)}
          >
            <Info className="mr-2 h-4 w-4" />
            详情
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
