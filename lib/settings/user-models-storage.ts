/**
 * 匿名用户模型 LocalStorage 存储
 * 为未登录用户提供本地模型配置存储
 *
 * 存储结构：
 * - key: user_models_<anonymousId>
 * - value: UserModelData[] JSON字符串
 */

import { useEffect, useState, useCallback } from "react";

// LocalStorage 存储键名前缀
const STORAGE_KEY_PREFIX = "user_models_";

// 用户模型数据结构（用于本地存储）
export interface LocalUserModel {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 获取存储键名
 */
function getStorageKey(anonymousId: string): string {
  return `${STORAGE_KEY_PREFIX}${anonymousId}`;
}

/**
 * 从 LocalStorage 获取模型列表
 *
 * @param anonymousId - 匿名用户ID
 * @returns 模型列表
 */
export function getLocalModels(anonymousId: string): LocalUserModel[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const key = getStorageKey(anonymousId);
    const data = localStorage.getItem(key);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as LocalUserModel[];
  } catch (error) {
    console.error("从 LocalStorage 读取模型失败:", error);
    return [];
  }
}

/**
 * 保存模型列表到 LocalStorage
 *
 * @param anonymousId - 匿名用户ID
 * @param models - 模型列表
 */
export function saveLocalModels(
  anonymousId: string,
  models: LocalUserModel[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStorageKey(anonymousId);
    localStorage.setItem(key, JSON.stringify(models));
  } catch (error) {
    console.error("保存模型到 LocalStorage 失败:", error);
    throw new Error("保存失败，可能是存储空间不足");
  }
}

/**
 * 添加新模型
 *
 * @param anonymousId - 匿名用户ID
 * @param model - 要添加的模型
 * @returns 更新后的模型列表
 */
export function addLocalModel(
  anonymousId: string,
  model: Omit<LocalUserModel, "createdAt" | "updatedAt">
): LocalUserModel[] {
  const models = getLocalModels(anonymousId);
  const now = Date.now();

  const newModel: LocalUserModel = {
    ...model,
    createdAt: now,
    updatedAt: now,
  };

  // 如果是第一个模型或设置为默认，先取消其他默认
  if (newModel.isDefault) {
    models.forEach((m) => (m.isDefault = false));
  }

  models.push(newModel);
  saveLocalModels(anonymousId, models);
  return models;
}

/**
 * 更新模型
 *
 * @param anonymousId - 匿名用户ID
 * @param modelId - 模型ID
 * @param updates - 要更新的字段
 * @returns 更新后的模型列表，如果模型不存在则返回 null
 */
export function updateLocalModel(
  anonymousId: string,
  modelId: string,
  updates: Partial<Omit<LocalUserModel, "id" | "createdAt">>
): LocalUserModel[] | null {
  const models = getLocalModels(anonymousId);
  const index = models.findIndex((m) => m.id === modelId);

  if (index === -1) {
    return null;
  }

  // 如果设置为默认，先取消其他默认
  if (updates.isDefault) {
    models.forEach((m) => (m.isDefault = false));
  }

  models[index] = {
    ...models[index],
    ...updates,
    updatedAt: Date.now(),
  };

  saveLocalModels(anonymousId, models);
  return models;
}

/**
 * 删除模型
 *
 * @param anonymousId - 匿名用户ID
 * @param modelId - 模型ID
 * @returns 更新后的模型列表，如果模型不存在则返回 null
 */
export function deleteLocalModel(
  anonymousId: string,
  modelId: string
): LocalUserModel[] | null {
  const models = getLocalModels(anonymousId);
  const index = models.findIndex((m) => m.id === modelId);

  if (index === -1) {
    return null;
  }

  const wasDefault = models[index].isDefault;
  models.splice(index, 1);

  // 如果删除的是默认模型，将第一个设为默认
  if (wasDefault && models.length > 0) {
    models[0].isDefault = true;
  }

  saveLocalModels(anonymousId, models);
  return models;
}

/**
 * 设置默认模型
 *
 * @param anonymousId - 匿名用户ID
 * @param modelId - 模型ID
 * @returns 更新后的模型列表，如果模型不存在则返回 null
 */
export function setDefaultLocalModel(
  anonymousId: string,
  modelId: string
): LocalUserModel[] | null {
  const models = getLocalModels(anonymousId);
  const index = models.findIndex((m) => m.id === modelId);

  if (index === -1) {
    return null;
  }

  models.forEach((m) => (m.isDefault = false));
  models[index].isDefault = true;
  models[index].updatedAt = Date.now();

  saveLocalModels(anonymousId, models);
  return models;
}

/**
 * 获取默认模型
 *
 * @param anonymousId - 匿名用户ID
 * @returns 默认模型，如果没有则返回 null
 */
export function getDefaultLocalModel(
  anonymousId: string
): LocalUserModel | null {
  const models = getLocalModels(anonymousId);
  return models.find((m) => m.isDefault) || models[0] || null;
}

/**
 * 清空所有本地模型
 *
 * @param anonymousId - 匿名用户ID
 */
export function clearLocalModels(anonymousId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const key = getStorageKey(anonymousId);
  localStorage.removeItem(key);
}

/**
 * 将本地模型同步到服务器
 *
 * @param anonymousId - 匿名用户ID
 * @returns 可同步的模型列表
 */
export function getModelsForSync(
  anonymousId: string
): Array<{
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isDefault?: boolean;
}> {
  const models = getLocalModels(anonymousId);
  return models.map((m) => ({
    name: m.name,
    provider: m.provider,
    model: m.model,
    apiKey: m.apiKey,
    baseUrl: m.baseUrl,
    isDefault: m.isDefault,
  }));
}

/**
 * 同步完成后清理本地模型
 *
 * @param anonymousId - 匿名用户ID
 */
export function clearModelsAfterSync(anonymousId: string): void {
  clearLocalModels(anonymousId);
}

/**
 * React Hook: 使用本地模型存储
 *
 * @param anonymousId - 匿名用户ID
 * @returns 模型列表和操作函数
 */
export function useLocalModels(anonymousId: string | null) {
  const [models, setModels] = useState<LocalUserModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载模型列表
  useEffect(() => {
    if (!anonymousId) {
      setModels([]);
      setIsLoading(false);
      return;
    }

    const loaded = getLocalModels(anonymousId);
    setModels(loaded);
    setIsLoading(false);
  }, [anonymousId]);

  // 添加模型
  const addModel = useCallback(
    (model: Omit<LocalUserModel, "createdAt" | "updatedAt">) => {
      if (!anonymousId) return;
      const updated = addLocalModel(anonymousId, model);
      setModels(updated);
    },
    [anonymousId]
  );

  // 更新模型
  const updateModel = useCallback(
    (modelId: string, updates: Partial<Omit<LocalUserModel, "id" | "createdAt">>) => {
      if (!anonymousId) return;
      const updated = updateLocalModel(anonymousId, modelId, updates);
      if (updated) {
        setModels(updated);
      }
    },
    [anonymousId]
  );

  // 删除模型
  const deleteModel = useCallback(
    (modelId: string) => {
      if (!anonymousId) return;
      const updated = deleteLocalModel(anonymousId, modelId);
      if (updated) {
        setModels(updated);
      }
    },
    [anonymousId]
  );

  // 设置默认模型
  const setDefaultModel = useCallback(
    (modelId: string) => {
      if (!anonymousId) return;
      const updated = setDefaultLocalModel(anonymousId, modelId);
      if (updated) {
        setModels(updated);
      }
    },
    [anonymousId]
  );

  return {
    models,
    isLoading,
    addModel,
    updateModel,
    deleteModel,
    setDefaultModel,
    getDefaultModel: useCallback(() => {
      if (!anonymousId) return null;
      return getDefaultLocalModel(anonymousId);
    }, [anonymousId]),
  };
}
