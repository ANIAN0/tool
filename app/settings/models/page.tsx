/**
 * 模型设置页面
 * 表格布局展示模型列表，详情通过右侧抽屉展示
 */

"use client";

import { useUserModels } from "@/lib/hooks/use-user-models";
import { useAuth } from "@/lib/hooks/use-auth";
import { ModelTable } from "./components/model-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * 模型设置页面组件
 */
export default function ModelsSettingsPage() {
  const { isAuthenticated, isLoading: authLoading, anonymousId } = useAuth();

  const {
    models,
    isLoading,
    error,
    createModel,
    updateModel,
    deleteModel,
    setDefaultModel,
    refreshModels,
    clearError,
  } = useUserModels(anonymousId ?? undefined);

  // 如果认证状态还在加载中，显示加载状态
  if (authLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">模型设置</h1>
          <p className="text-muted-foreground mt-1">
            管理您的自定义 LLM 模型配置（OpenAI-Compatible）
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 未登录用户提示 */}
      {!isAuthenticated && (
        <Alert variant="default">
          <Info className="h-4 w-4" />
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            您当前处于未登录状态，模型配置将保存在本地浏览器中。
            登录后可以将本地配置同步到云端。
          </AlertDescription>
        </Alert>
      )}

      {/* 模型表格 */}
      <ModelTable
        models={models}
        isLoading={isLoading}
        error={error}
        onCreate={createModel}
        onUpdate={updateModel}
        onDelete={deleteModel}
        onSetDefault={setDefaultModel}
        onRefresh={refreshModels}
        onClearError={clearError}
      />
    </div>
  );
}