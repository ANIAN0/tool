/**
 * 用户模型管理 Hook
 * 仅支持已登录用户的模型操作
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

// API 模型数据类型（与后端返回的数据一致）
export interface ApiUserModel {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  model: string;
  base_url: string | null;
  is_default: boolean;
  context_limit: number;
  created_at: number;
  updated_at: number;
}

// 统一的模型数据类型
export type UserModel = ApiUserModel;

// 创建模型的参数
export interface CreateModelParams {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isDefault?: boolean;
  contextLimit?: number;
}

// 更新模型的参数
export interface UpdateModelParams {
  name?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  isDefault?: boolean;
  contextLimit?: number;
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

  // 辅助函数
  clearError: () => void;
}

/**
 * 用户模型管理 Hook
 * 仅支持已登录用户，未登录用户调用将返回空列表
 *
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
 * } = useUserModels();
 * ```
 */
export function useUserModels(): UseUserModelsReturn {
  const { isAuthenticated, user } = useAuth();

  const [models, setModels] = useState<UserModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取认证用户的模型列表
  const fetchAuthModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authenticatedFetch("/api/user/models");
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

  // 初始加载
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuthModels();
    } else {
      // 未登录用户返回空列表
      setModels([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchAuthModels]);

  // 创建模型
  const createModel = useCallback(
    async (params: CreateModelParams): Promise<boolean> => {
      try {
        setError(null);

        if (!isAuthenticated || !user) {
          setError("请先登录");
          return false;
        }

        const response = await authenticatedFetch("/api/user/models", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "创建模型失败");
        }

        await fetchAuthModels();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建模型失败");
        return false;
      }
    },
    [isAuthenticated, user, fetchAuthModels]
  );

  // 更新模型
  const updateModel = useCallback(
    async (id: string, params: UpdateModelParams): Promise<boolean> => {
      try {
        setError(null);

        if (!isAuthenticated) {
          setError("请先登录");
          return false;
        }

        const response = await authenticatedFetch(`/api/user/models/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "更新模型失败");
        }

        await fetchAuthModels();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新模型失败");
        return false;
      }
    },
    [isAuthenticated, fetchAuthModels]
  );

  // 删除模型
  const deleteModel = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);

        if (!isAuthenticated) {
          setError("请先登录");
          return false;
        }

        const response = await authenticatedFetch(`/api/user/models/${id}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "删除模型失败");
        }

        await fetchAuthModels();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "删除模型失败");
        return false;
      }
    },
    [isAuthenticated, fetchAuthModels]
  );

  // 设置默认模型
  const setDefaultModel = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);

        if (!isAuthenticated) {
          setError("请先登录");
          return false;
        }

        const response = await authenticatedFetch(`/api/user/models/${id}/default`, {
          method: "PATCH",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "设置默认模型失败");
        }

        await fetchAuthModels();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "设置默认模型失败");
        return false;
      }
    },
    [isAuthenticated, fetchAuthModels]
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
    }
  }, [isAuthenticated, fetchAuthModels]);

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
    clearError,
  };
}