/**
 * Agent 表格组件
 * 表格布局展示 Agent 列表，详情通过右侧抽屉展示
 */

"use client";

import { useState, useEffect } from "react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Eye,
  Trash2,
  Brain,
  RefreshCw,
  MoreHorizontal,
  Globe,
  Lock,
  Pencil,
} from "lucide-react";
import type { AgentWithTools, PublicAgentWithCreator } from "@/lib/db/schema";

// Agent 列表数据类型（合并我的和公开的）
interface AgentListItem {
  id: string;
  name: string;
  description: string | null;
  template_id: string;
  is_public: boolean;
  isOwner: boolean; // 是否是创建者
  enabledSystemTools?: string[];
  tools: Array<{ source: string }>;
  created_at: number;
  updated_at: number;
}

// Agent 表格组件属性
interface AgentTableProps {
  myAgents: AgentWithTools[];
  publicAgents: PublicAgentWithCreator[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onView: (agentId: string) => void;
  onEdit: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onTogglePublic: (agentId: string, isPublic: boolean) => void;
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Agent 表格组件
 */
export function AgentTable({
  myAgents,
  publicAgents,
  isLoading,
  onRefresh,
  onCreate,
  onView,
  onEdit,
  onDelete,
  onTogglePublic,
}: AgentTableProps) {
  // 合并我的 Agent 和公开 Agent 列表
  const [agents, setAgents] = useState<AgentListItem[]>([]);

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AgentListItem | null>(null);

  // 合并列表（我的 Agent + 公开 Agent）
  useEffect(() => {
    const myList: AgentListItem[] = myAgents.map((agent) => ({
      ...agent,
      isOwner: true,
    }));

    const publicList: AgentListItem[] = publicAgents
      .filter((agent) => !myAgents.some((my) => my.id === agent.id)) // 排除重复（我的已公开的）
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        template_id: agent.template_id,
        is_public: agent.is_public,
        isOwner: false,
        enabledSystemTools: agent.enabledSystemTools,
        tools: agent.tools,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      }));

    setAgents([...myList, ...publicList]);
  }, [myAgents, publicAgents]);

  // 打开删除确认对话框
  const handleDeleteClick = (agent: AgentListItem) => {
    if (!agent.isOwner) return; // 非创建者不能删除
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const confirmDelete = () => {
    if (!agentToDelete) return;
    onDelete(agentToDelete.id);
    setDeleteDialogOpen(false);
    setAgentToDelete(null);
  };

  // 取消删除
  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setAgentToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent 配置管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理您的 AI Agent</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="size-4" />
          创建 Agent
        </Button>
      </div>

      {/* 表格区域 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">名称</TableHead>
              <TableHead className="w-[200px]">描述</TableHead>
              <TableHead className="w-[100px]">模板</TableHead>
              <TableHead className="w-[100px]">工具</TableHead>
              <TableHead className="w-[120px]">更新时间</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 加载状态：骨架屏 */}
            {isLoading &&
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}

            {/* 空状态 */}
            {!isLoading && agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <Brain className="size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无 Agent，点击创建添加</p>
                    <Button variant="outline" onClick={onCreate}>
                      <Plus className="size-4" />
                      创建 Agent
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 数据行 */}
            {!isLoading &&
              agents.map((agent) => (
                <TableRow key={agent.id} className="hover:bg-muted/50">
                  {/* 名称列（含公开状态徽章） */}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {agent.name}
                      {/* 公开/私有状态徽章 */}
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
                  </TableCell>

                  {/* 描述列 */}
                  <TableCell className="truncate max-w-[200px] text-muted-foreground">
                    {agent.description || "-"}
                  </TableCell>

                  {/* 模板列 */}
                  <TableCell>
                    <Badge variant="outline">{agent.template_id}</Badge>
                  </TableCell>

                  {/* 工具数列 */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* 系统工具 */}
                      {(agent.enabledSystemTools?.length ?? 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {agent.enabledSystemTools?.length} 系统工具
                        </Badge>
                      )}
                      {/* MCP工具 */}
                      {agent.tools.filter((t) => t.source === "mcp").length > 0 && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                          {agent.tools.filter((t) => t.source === "mcp").length} MCP
                        </Badge>
                      )}
                      {/* 无工具 */}
                      {(agent.enabledSystemTools?.length ?? 0) === 0 &&
                        agent.tools.length === 0 && (
                          <span className="text-xs text-muted-foreground">无</span>
                        )}
                    </div>
                  </TableCell>

                  {/* 更新时间列 */}
                  <TableCell className="text-muted-foreground">
                    {formatDate(agent.updated_at)}
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
                        {/* 查看详情 */}
                        <DropdownMenuItem onClick={() => onView(agent.id)}>
                          <Eye className="size-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>

                        {/* 创建者才能编辑和切换公开 */}
                        {agent.isOwner && (
                          <>
                            <DropdownMenuItem onClick={() => onEdit(agent.id)}>
                              <Pencil className="size-4 mr-2" />
                              编辑
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => onTogglePublic(agent.id, !agent.is_public)}
                            >
                              {agent.is_public ? (
                                <>
                                  <Lock className="size-4 mr-2" />
                                  设为私有
                                </>
                              ) : (
                                <>
                                  <Globe className="size-4 mr-2" />
                                  设为公开
                                </>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(agent)}
                            >
                              <Trash2 className="size-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 Agent "{agentToDelete?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}