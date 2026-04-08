/**
 * 模型详情抽屉组件
 * 使用 Sheet 展示模型详情，支持查看和编辑模式切换
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Settings,
  Layers,
  Link,
  Edit,
  Trash2,
  RefreshCw,
  Save,
  X,
  Star,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserModel, CreateModelParams, UpdateModelParams } from "@/lib/hooks/use-user-models";

// 统一的模型详情数据类型（兼容 API 和本地模型）
interface ModelDetailData {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isDefault: boolean;
  contextLimit: number;
  createdAt: number;
  updatedAt: number;
  linkedAgents: number; // Agent 关联数（暂用占位值）
}

interface ModelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: UserModel | null;
  isLoading?: boolean;
  error?: string | null;
  onUpdate: (id: string, params: UpdateModelParams) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onSetDefault: (id: string) => Promise<boolean>;
  onRetry?: () => void;
}

/**
 * 格式化日期时间
 */
function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 统一获取模型属性（兼容 API 和本地模型）
 */
function getModelData(model: UserModel): ModelDetailData {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    model: model.model,
    baseUrl: ("base_url" in model ? model.base_url : model.baseUrl) ?? null,
    isDefault: "is_default" in model ? model.is_default : model.isDefault,
    contextLimit: "context_limit" in model ? model.context_limit ?? 32000 : 32000,
    createdAt: "created_at" in model ? model.created_at : model.createdAt ?? Date.now(),
    updatedAt: "updated_at" in model ? model.updated_at : model.updatedAt ?? Date.now(),
    linkedAgents: 0, // 暂用占位值，后续可接入 API
  };
}

/**
 * 模型详情抽屉组件
 */
export function ModelSheet({
  open,
  onOpenChange,
  model,
  isLoading = false,
  error,
  onUpdate,
  onDelete,
  onSetDefault,
  onRetry,
}: ModelSheetProps) {
  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    name: "",
    model: "",
    apiKey: "",
    baseUrl: "",
    contextLimit: "32000",
    isDefault: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 当模型数据变化时，重置表单和编辑状态
  useEffect(() => {
    if (model) {
      const data = getModelData(model);
      setFormData({
        name: data.name,
        model: data.model,
        apiKey: "",
        baseUrl: data.baseUrl ?? "",
        contextLimit: data.contextLimit.toString(),
        isDefault: data.isDefault,
      });
      setIsEditing(false);
      setFormErrors({});
    }
  }, [model]);

  // 关闭抽屉时清理状态
  const handleClose = () => {
    setIsEditing(false);
    setFormErrors({});
    onOpenChange(false);
  };

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = "模型名称是必填项";
    }
    if (!formData.model.trim()) {
      errors.model = "模型 ID 是必填项";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 提交更新
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model || !validateForm()) return;

    setIsSubmitting(true);
    try {
      const params: UpdateModelParams = {
        name: formData.name.trim(),
        model: formData.model.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        baseUrl: formData.baseUrl.trim() || undefined,
        contextLimit: parseInt(formData.contextLimit, 10) || undefined,
        isDefault: formData.isDefault,
      };

      const success = await onUpdate(model.id, params);
      if (success) {
        setIsEditing(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理删除
  const handleDelete = async () => {
    if (!model) return;
    setIsDeleting(true);
    try {
      await onDelete(model.id);
      handleClose();
    } finally {
      setIsDeleting(false);
    }
  };

  // 设为默认
  const handleSetDefault = async () => {
    if (!model) return;
    await onSetDefault(model.id);
  };

  // 加载状态
  if (isLoading && !model) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="text-xl">加载中...</SheetTitle>
            <SheetDescription className="text-base">正在获取模型详情</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6">
            <div className="flex flex-col gap-6 py-6">
              {/* 统计卡片骨架 */}
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg p-4">
                    <Skeleton className="h-3 w-16 mb-2" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  // 错误状态
  if (error && !model) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="text-xl">加载失败</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6">
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <RefreshCw className="size-5 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{error}</p>
              {onRetry && (
                <Button variant="outline" onClick={onRetry}>
                  重试
                </Button>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  // 无模型数据
  if (!model) {
    return null;
  }

  const modelData = getModelData(model);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        {/* 头部区域 */}
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl flex items-center gap-2">
                <Bot className="size-5 text-muted-foreground" />
                {isEditing ? "编辑模型" : modelData.name}
                {modelData.isDefault && !isEditing && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="size-3" />
                    默认
                  </span>
                )}
              </SheetTitle>
              <SheetDescription className="text-base mt-1">
                {isEditing ? "修改模型配置信息" : `${modelData.provider} / ${modelData.model}`}
              </SheetDescription>
            </div>
            {/* 操作按钮组 - 仅在查看模式显示 */}
            {!isEditing && (
              <div className="flex gap-1">
                {!modelData.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSetDefault}
                    title="设为默认"
                  >
                    <Star className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  title="编辑"
                >
                  <Edit className="size-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="删除"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除模型?</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将永久删除模型 "{modelData.name}"，删除后无法恢复。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "删除中..." : "删除"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* 内容区域 */}
        <ScrollArea className="flex-1 px-6">
          {isEditing ? (
            // 编辑表单
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-6">
              {/* 模型名称 */}
              <div className="space-y-2">
                <Label htmlFor="name">模型名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: 我的 GPT-4"
                  disabled={isSubmitting}
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              {/* Provider */}
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" value="OpenAI-Compatible (openai)" disabled />
              </div>

              {/* 模型 ID */}
              <div className="space-y-2">
                <Label htmlFor="model">模型 ID *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="例如: gpt-4"
                  disabled={isSubmitting}
                />
                {formErrors.model && (
                  <p className="text-sm text-destructive">{formErrors.model}</p>
                )}
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  API Key
                  <span className="text-muted-foreground text-xs ml-2">
                    (留空表示不修改)
                  </span>
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
              </div>

              {/* Base URL */}
              <div className="space-y-2">
                <Label htmlFor="baseUrl">
                  Base URL
                  <span className="text-muted-foreground text-xs ml-2">
                    (可选，留空使用默认)
                  </span>
                </Label>
                <Input
                  id="baseUrl"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  disabled={isSubmitting}
                />
              </div>

              {/* 上下文上限 */}
              <div className="space-y-2">
                <Label htmlFor="contextLimit">
                  上下文上限 (tokens)
                  <span className="text-muted-foreground text-xs ml-2">
                    (模型支持的最大 token 数)
                  </span>
                </Label>
                <Input
                  id="contextLimit"
                  type="number"
                  value={formData.contextLimit}
                  onChange={(e) => setFormData({ ...formData, contextLimit: e.target.value })}
                  placeholder="32000"
                  disabled={isSubmitting}
                  min={1}
                />
              </div>

              {/* 设为默认 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDefault: checked as boolean })
                  }
                  disabled={isSubmitting}
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  设为默认模型
                </Label>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  <X className="size-4" />
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="size-4" />
                  {isSubmitting ? "保存中..." : "保存修改"}
                </Button>
              </div>
            </form>
          ) : (
            // 查看详情
            <div className="flex flex-col gap-6 py-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Calendar className="size-3" />
                    <span>创建时间</span>
                  </div>
                  <div className="text-sm font-medium">
                    {formatDateTime(modelData.createdAt)}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Calendar className="size-3" />
                    <span>更新时间</span>
                  </div>
                  <div className="text-sm font-medium">
                    {formatDateTime(modelData.updatedAt)}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Layers className="size-3" />
                    <span>上下文上限</span>
                  </div>
                  <div className="text-sm font-medium">
                    {modelData.contextLimit.toLocaleString()} tokens
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Settings className="size-3" />
                    <span>Agent 关联</span>
                  </div>
                  <div className="text-sm font-medium">
                    {modelData.linkedAgents} 个
                  </div>
                </div>
              </div>

              {/* 基础信息区块 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">基础信息</span>
                </div>
                <div className="bg-muted/30 rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Provider</span>
                    <span className="text-sm font-medium">{modelData.provider}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">模型 ID</span>
                    <span className="text-sm font-medium">{modelData.model}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Base URL</span>
                    <span className="text-sm font-medium truncate max-w-[300px]">
                      {modelData.baseUrl || "使用默认"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">默认模型</span>
                    <span className={cn(
                      "text-sm font-medium",
                      modelData.isDefault ? "text-primary" : "text-muted-foreground"
                    )}>
                      {modelData.isDefault ? "是" : "否"}
                    </span>
                  </div>
                </div>
              </div>

              {/* API 信息区块 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Link className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">API 信息</span>
                </div>
                <div className="bg-muted/30 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">API Key</span>
                    <span className="text-sm text-muted-foreground">•••••••• (已加密)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    API Key 已加密存储，如需修改请点击编辑按钮
                  </p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}