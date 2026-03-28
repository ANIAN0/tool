/**
 * 模型卡片组件
 * 展示单个模型的信息和操作按钮
 */

import { useState } from "react";
import { Check, Edit, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import type { UserModel } from "@/lib/hooks/use-user-models";

interface ModelCardProps {
  model: UserModel;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onSetDefault: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * 模型卡片组件
 */
export function ModelCard({
  model,
  onEdit,
  onDelete,
  onSetDefault,
  isLoading = false,
}: ModelCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // 判断是否为默认模型
  const isDefault = "is_default" in model ? model.is_default : model.isDefault;

  // 处理删除
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card
      className={cn(
        "relative transition-all",
        isDefault && "border-primary ring-1 ring-primary"
      )}
    >
      {/* 默认模型标记 */}
      {isDefault && (
        <div className="absolute -top-2 left-4 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          默认
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{model.name}</CardTitle>
            <CardDescription className="mt-1">
              OpenAI-Compatible / {model.model}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {/* 设为默认按钮 */}
            {!isDefault && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSetDefault}
                disabled={isLoading}
                title="设为默认"
              >
                <Star className="w-4 h-4" />
              </Button>
            )}

            {/* 编辑按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              disabled={isLoading}
              title="编辑"
            >
              <Edit className="w-4 h-4" />
            </Button>

            {/* 删除按钮 */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isLoading || isDeleting}
                  title="删除"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除模型?</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作将永久删除模型 &quot;{model.name}&quot;。
                    删除后无法恢复。
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
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Base URL 信息（如果有） */}
        {"base_url" in model && model.base_url ? (
          <p className="text-xs text-muted-foreground truncate">
            API: {model.base_url}
          </p>
        ) : "baseUrl" in model && model.baseUrl ? (
          <p className="text-xs text-muted-foreground truncate">
            API: {model.baseUrl}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
