/**
 * 模型列表组件
 * 展示所有模型并提供添加/编辑/删除功能
 */

import { useState } from "react";
import { Plus, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelCard } from "./model-card";
import { ModelForm } from "./model-form";
import type { UserModel, CreateModelParams, UpdateModelParams } from "@/lib/hooks/use-user-models";

interface ModelListProps {
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
 * 模型列表组件
 */
export function ModelList({
  models,
  isLoading,
  error,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
  onRefresh,
  onClearError,
}: ModelListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<UserModel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 打开添加表单
  const handleAdd = () => {
    setEditingModel(null);
    setIsFormOpen(true);
    onClearError();
  };

  // 打开编辑表单
  const handleEdit = (model: UserModel) => {
    setEditingModel(model);
    setIsFormOpen(true);
    onClearError();
  };

  // 关闭表单
  const handleClose = () => {
    setIsFormOpen(false);
    setEditingModel(null);
  };

  // 提交表单
  const handleSubmit = async (data: CreateModelParams | UpdateModelParams) => {
    setIsSubmitting(true);
    try {
      let success: boolean;

      if (editingModel) {
        // 更新现有模型
        success = await onUpdate(
          "is_default" in editingModel ? editingModel.id : editingModel.id,
          data as UpdateModelParams
        );
      } else {
        // 创建新模型
        success = await onCreate(data as CreateModelParams);
      }

      if (success) {
        handleClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理删除
  const handleDelete = async (id: string) => {
    await onDelete(id);
  };

  // 处理设为默认
  const handleSetDefault = async (id: string) => {
    await onSetDefault(id);
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">我的模型</h2>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">我的模型</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          添加模型
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 模型列表 */}
      {models.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground mb-4">还没有添加任何模型</p>
          <Button onClick={handleAdd} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            添加第一个模型
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onEdit={() => handleEdit(model)}
              onDelete={() => handleDelete(model.id)}
              onSetDefault={() => handleSetDefault(model.id)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* 添加/编辑表单 */}
      <ModelForm
        key={`${editingModel?.id ?? "new"}-${isFormOpen ? "open" : "closed"}`}
        isOpen={isFormOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialData={editingModel}
        isLoading={isSubmitting}
      />
    </div>
  );
}
