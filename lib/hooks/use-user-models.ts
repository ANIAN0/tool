/**
 * 用户模型管理 Hook
 * 统一管理认证用户和匿名用户的模型操作
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { nanoid } from "nanoid";
import {
  getLocalModels,
  addLocalModel,
  updateLocalModel,
  deleteLocalModel,
  setDefaultLocalModel,
  getDefaultLocalModel,
  clearModelsAfterSync,
  type LocalUserModel,
} from "./user-models-storage";

// API 模型数据类型（与后端返回的数据一致）
export interface ApiUserModel {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  model: string;
  base_url: string | null;
  is_default: boolean;
  created_at: number;
  updated_at: number;
}

// 统一的模型数据类型
export type UserModel = LocalUserModel | ApiUserModel;

// 创建模型的参数
export interface CreateModelParams {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isDefault?: boolean;
}

// 更新模型的参数
export interface UpdateModelParams {
  name?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  isDefault?: boolean;
}

// Hook 返回类型
export interface UseUserModelsReturn {
  // 状态
  models: UserModel[];
  isLoading: boolean;
  error: string | null;

  // 操作函数
  createModel: (params: CreateModelParams) => Promise<boolean>;
  updateModel: (id: string, params: UpdateModelParams) => Promise<boolean>;
  deleteModel: (id: string) => Promise<boolean>;
  setDefaultModel: (id: string) => Promise<boolean>;
  getDefaultModel: () => UserModel | null;
  refreshModels: () => Promise<void>;

  // 同步相关（仅认证用户）
  syncLocalModels: (anonymousId: string) => Promise<boolean>;

  // 辅助函数
  clearError: () => void;
}

/**
 * 用户模型管理 Hook
 *
 * @param anonymousId - 匿名用户ID（可选）
 * @returns 模型管理方法和状态
 *
 * @example
 * ```tsx
 * const {
 *   models,
 *   isLoading,
 *   createModel,
 *   deleteModel,
 *   getDefaultModel,
 * } = useUserModels(anonymousId);
 * ```
 */
export function useUserModels(
  anonymousId?: string
): UseUserModelsReturn {
  // 使用 next-auth 的 useSession hook 获取会话状态
  // 在静态预渲染期间 useSession 可能返回 undefined，所以需要提供默认值
  const sessionResult = useSession() || { data: null, status: "unauthenticated" };
  const { data: session, status: sessionStatus } = sessionResult;
  const isAuthenticated = sessionStatus === "authenticated";

  const [models, setModels] = useState<UserModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取认证用户的模型列表
  const fetchAuthModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/user/models");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "获取模型列表失败");
      }

      setModels(data.data as ApiUserModel[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取模型列表失败");
      console.error("获取模型列表失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 获取匿名用户的模型列表
  const fetchAnonymousModels = useCallback(() => {
    if (!anonymousId) {
      setModels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const localModels = getLocalModels(anonymousId);
      setModels(localModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取本地模型失败");
      console.error("获取本地模型失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, [anonymousId]);

  // 初始加载
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuthModels();
    } else {
      fetchAnonymousModels();
    }
  }, [isAuthenticated, fetchAuthModels, fetchAnonymousModels]);

  // 创建模型
  const createModel = useCallback(
    async (params: CreateModelParams): Promise<boolean> => {
      try {
        setError(null);

        if (isAuthenticated) {
          // 认证用户：调用 API
          const response = await fetch("/api/user/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "创建模型失败");
          }

          // 刷新列表
          await fetchAuthModels();
        } else {
          // 匿名用户：保存到 LocalStorage
          if (!anonymousId) {
            throw new Error("匿名用户ID不能为空");
          }

          const newModel = {
            id: nanoid(),
            name: params.name,
            provider: params.provider,
            model: params.model,
            apiKey: params.apiKey,
            baseUrl: params.baseUrl,
            isDefault: params.isDefault ?? false,
          };

          const updated = addLocalModel(anonymousId, newModel);
          setModels(updated);
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建模型失败");
        return false;
      }
    },
    [isAuthenticated, anonymousId, fetchAuthModels]
  );

  // 更新模型
  const updateModel = useCallback(
    async (id: string, params: UpdateModelParams): Promise<boolean> => {
      try {
        setError(null);

        if (isAuthenticated) {
          // 认证用户：调用 API
          const response = await fetch(`/api/user/models/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "更新模型失败");
          }

          await fetchAuthModels();
        } else {
          // 匿名用户：更新 LocalStorage
          if (!anonymousId) {
            throw new Error("匿名用户ID不能为空");
          }

          const updated = updateLocalModel(anonymousId, id, {
            name: params.name,
            provider: params.provider,
            model: params.model,
            apiKey: params.apiKey,
            baseUrl: params.baseUrl,
            isDefault: params.isDefault,
            updatedAt: Date.now(),
          });

          if (updated) {
            setModels(updated);
          } else {
            throw new Error("模型不存在");
          }
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新模型失败");
        return false;
      }
    },
    [isAuthenticated, anonymousId, fetchAuthModels]
  );

  // 删除模型
  const deleteModel = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);

        if (isAuthenticated) {
          // 认证用户：调用 API
          const response = await fetch(`/api/user/models/${id}`, {
            method: "DELETE",
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "删除模型失败");
          }

          await fetchAuthModels();
        } else {
          // 匿名用户：从 LocalStorage 删除
          if (!anonymousId) {
            throw new Error("匿名用户ID不能为空");
          }

          const updated = deleteLocalModel(anonymousId, id);

          if (updated) {
            setModels(updated);
          } else {
            throw new Error("模型不存在");
          }
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "删除模型失败");
        return false;
      }
    },
    [isAuthenticated, anonymousId, fetchAuthModels]
  );

  // 设置默认模型
  const setDefaultModel = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);

        if (isAuthenticated) {
          // 认证用户：调用 API
          const response = await fetch(`/api/user/models/${id}/default`, {
            method: "PATCH",
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "设置默认模型失败");
          }

          await fetchAuthModels();
        } else {
          // 匿名用户：更新 LocalStorage
          if (!anonymousId) {
            throw new Error("匿名用户ID不能为空");
          }

          const updated = setDefaultLocalModel(anonymousId, id);

          if (updated) {
            setModels(updated);
          } else {
            throw new Error("模型不存在");
          }
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "设置默认模型失败");
        return false;
      }
    },
    [isAuthenticated, anonymousId, fetchAuthModels]
  );

  // 获取默认模型
  const getDefaultModel = useCallback((): UserModel | null => {
    return models.find((m) =>
      "is_default" in m ? m.is_default : m.isDefault
    ) || models[0] || null;
  }, [models]);

  // 刷新模型列表
  const refreshModels = useCallback(async () => {
    if (isAuthenticated) {
      await fetchAuthModels();
    } else {
      fetchAnonymousModels();
    }
  }, [isAuthenticated, fetchAuthModels, fetchAnonymousModels]);

  // 同步本地模型（认证用户使用）
  const syncLocalModels = useCallback(
    async (localAnonymousId: string): Promise<boolean> => {
      if (!isAuthenticated) {
        setError("只有认证用户可以同步模型");
        return false;
      }

      try {
        setError(null);

        // 获取本地模型
        const localModels = getLocalModels(localAnonymousId);

        if (localModels.length === 0) {
          return true; // 没有需要同步的模型
        }

        // 准备同步数据
        const modelsToSync = localModels.map((m) => ({
          name: m.name,
          provider: m.provider,
          model: m.model,
          apiKey: m.apiKey,
          baseUrl: m.baseUrl,
          isDefault: m.isDefault,
        }));

        // 调用同步 API
        const response = await fetch("/api/user/models/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ models: modelsToSync }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "同步模型失败");
        }

        // 清空本地模型
        clearModelsAfterSync(localAnonymousId);

        // 刷新列表
        await fetchAuthModels();

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "同步模型失败");
        return false;
      }
    },
    [isAuthenticated, fetchAuthModels]
  );

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    models,
    isLoading,
    error,
    createModel,
    updateModel,
    deleteModel,
    setDefaultModel,
    getDefaultModel,
    refreshModels,
    syncLocalModels,
    clearError,
  };
}
