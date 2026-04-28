/**
 * 模型设置页面
 * 表格布局展示模型列表，详情通过右侧抽屉展示
 *
 * 注意：middleware 已配置登录保护，未登录会重定向到登录页
 */

"use client";

import { useUserModels } from "@/lib/hooks/use-user-models";
import { useAuth } from "@/lib/hooks/use-auth";
import { ModelTable } from "./components/model-table";

/**
 * 模型设置页面组件
 */
export default function ModelsSettingsPage() {
  const { isLoading: authLoading } = useAuth();

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
  } = useUserModels();

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