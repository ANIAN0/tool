/**
 * 模型设置页面
 * 用户可以管理自己的 LLM 模型配置
 */

"use client";

import { useUserModels } from "@/lib/hooks/use-user-models";
import { ModelList } from "./components/model-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * 获取匿名用户ID
 * 从 localStorage 或 sessionStorage 中获取
 */
function getAnonymousId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  // 尝试从 localStorage 获取
  const localId = localStorage.getItem("anonymous_user_id");
  if (localId) {
    return localId;
  }

  // 尝试从 sessionStorage 获取
  const sessionId = sessionStorage.getItem("anonymous_user_id");
  if (sessionId) {
    return sessionId;
  }

  return undefined;
}

/**
 * 模型设置页面组件
 */
export default function ModelsSettingsPage() {
  const anonymousId = getAnonymousId();

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
  } = useUserModels(anonymousId);

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">模型设置</h1>
        <p className="text-muted-foreground mt-1">
          管理您的自定义 LLM 模型配置，支持 OpenAI、Anthropic、Google 等多种 Provider
        </p>
      </div>

      {/* 匿名用户提示 */}
      {!anonymousId && (
        <Alert variant="default" className="bg-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            您当前处于未登录状态，模型配置将保存在本地浏览器中。
            登录后可以将本地配置同步到云端。
          </AlertDescription>
        </Alert>
      )}

      {/* 模型列表 */}
      <ModelList
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
