/**
 * Agent卡片组件
 * 展示单个Agent的简要信息
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Lock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { AgentWithTools } from "@/lib/db/schema";

// Agent卡片属性
interface AgentCardProps {
  agent: AgentWithTools;
  isOwner: boolean;
  onEdit: (agent: AgentWithTools) => void;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean) => void;
}

/**
 * Agent卡片组件
 */
export function AgentCard({
  agent,
  isOwner,
  onEdit,
  onDelete,
  onTogglePublic,
}: AgentCardProps) {
  // 格式化时间
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="relative">
      {/* 公开/私有标识 */}
      <div className="absolute right-2 top-2">
        {agent.is_public ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Globe className="mr-1 h-3 w-3" />
            公开
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
            <Lock className="mr-1 h-3 w-3" />
            私有
          </Badge>
        )}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-lg pr-8">{agent.name}</CardTitle>
        {/* 描述 */}
        {agent.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {/* Agent信息 */}
        <div className="space-y-2 text-sm">
          {/* 模板 */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">模板:</span>
            <Badge variant="outline">{agent.template_id}</Badge>
          </div>

          {/* 工具数量 */}
          {agent.tools.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">工具:</span>
              <span>{agent.tools.length} 个</span>
            </div>
          )}

          {/* 创建时间 */}
          <div className="text-xs text-muted-foreground">
            创建于 {formatDate(agent.created_at)}
          </div>
        </div>

        {/* 操作按钮（仅创建者可见） */}
        {isOwner && (
          <div className="mt-4 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* 编辑 */}
                <DropdownMenuItem onClick={() => onEdit(agent)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>

                {/* 切换公开状态 */}
                <DropdownMenuItem
                  onClick={() => onTogglePublic(agent.id, !agent.is_public)}
                >
                  {agent.is_public ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      设为私有
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      设为公开
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* 删除 */}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(agent.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
    </Card>
  );
}