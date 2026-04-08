/**
 * 模型表格组件
 * 表格布局展示模型列表，详情通过右侧抽屉展示
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Eye,
  Trash2,
  Bot,
  RefreshCw,
  Star,
  MoreHorizontal,
} from "lucide-react";
import { ModelSheet } from "./model-sheet";
import { ModelFormDialog } from "./model-form-dialog";
import type { UserModel, CreateModelParams, UpdateModelParams } from "@/lib/hooks/use-user-models";

interface ModelTableProps {
  models: UserModel[];
  isLoading: boolean;
  error: string | null;
  onCreate: (params: CreateModelParams) => Promise<boolean>;
  onUpdate: (id: string, params: UpdateModelParams) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onSetDefault: (id: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onClearError: () => void;
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
 * 统一获取模型属性（兼容 API 和本地模型）
 */
function getModelProperty(model: UserModel, property: string): unknown {
  switch (property) {
    case "baseUrl":
      return "base_url" in model ? model.base_url : model.baseUrl;
    case "isDefault":
      return "is_default" in model ? model.is_default : model.isDefault;
    case "createdAt":
      return "created_at" in model ? model.created_at : model.createdAt ?? Date.now();
    case "updatedAt":
      return "updated_at" in model ? model.updated_at : model.updatedAt ?? Date.now();
    default:
      return model[property as keyof UserModel];
  }
}

/**
 * 模型表格组件
 */
export function ModelTable({
  models,
  isLoading,
  error,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
  onRefresh,
  onClearError,
}: ModelTableProps) {
  // 详情抽屉状态
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<UserModel | null>(null);

  // 新增对话框状态
  const [formOpen, setFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 打开详情抽屉
  const handleView = (model: UserModel) => {
    setSelectedModel(model);
    setSheetOpen(true);
    onClearError();
  };

  // 关闭详情抽屉
  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedModel(null);
  };

  // 打开新增对话框
  const handleAdd = () => {
    setFormOpen(true);
    onClearError();
  };

  // 提交新增
  const handleSubmitCreate = async (params: CreateModelParams) => {
    setIsSubmitting(true);
    try {
      const success = await onCreate(params);
      if (success) {
        setFormOpen(false);
      }
      return success;
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除模型（从表格直接删除）
  const handleDelete = async (model: UserModel) => {
    if (!confirm(`确定要删除模型 "${model.name}" 吗？`)) {
      return;
    }
    await onDelete(model.id);
  };

  // 设为默认
  const handleSetDefault = async (model: UserModel) => {
    await onSetDefault(model.id);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">模型设置</h1>
          <p className="text-muted-foreground mt-1">
            管理您的自定义 LLM 模型配置（OpenAI-Compatible）
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            title="刷新"
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="size-4" />
            添加模型
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* 表格区域 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-[150px]">模型 ID</TableHead>
              <TableHead className="w-[100px]">Provider</TableHead>
              <TableHead className="w-[180px]">Base URL</TableHead>
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
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
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
            {!isLoading && models.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <Bot className="size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">还没有添加任何模型</p>
                    <Button variant="outline" onClick={handleAdd}>
                      <Plus className="size-4" />
                      添加第一个模型
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 数据行 */}
            {!isLoading &&
              models.map((model) => {
                const isDefault = getModelProperty(model, "isDefault") as boolean;
                const baseUrl = getModelProperty(model, "baseUrl") as string | null;
                const updatedAt = getModelProperty(model, "updatedAt") as number;

                return (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {model.name}
                        {isDefault && (
                          <Badge variant="default" className="text-xs">
                            <Star className="size-3 mr-1" />
                            默认
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {model.model}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{model.provider}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[180px]">
                      {baseUrl || "默认"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(updatedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(model)}>
                            <Eye className="size-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          {!isDefault && (
                            <DropdownMenuItem onClick={() => handleSetDefault(model)}>
                              <Star className="size-4 mr-2" />
                              设为默认
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(model)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* 新增模型对话框 */}
      <ModelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmitCreate}
        isLoading={isSubmitting}
      />

      {/* 详情抽屉 */}
      <ModelSheet
        open={sheetOpen}
        onOpenChange={handleCloseSheet}
        model={selectedModel}
        isLoading={isLoading}
        error={error}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
        onRetry={() => {
          onClearError();
          onRefresh();
        }}
      />
    </div>
  );
}