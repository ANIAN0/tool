/**
 * 用户模型本地存储管理模块
 * 管理匿名用户的模型数据存储在 LocalStorage 中
 */

// 本地存储的键名前缀
const STORAGE_KEY_PREFIX = "user_models:";

/**
 * 本地用户模型数据类型
 */
export interface LocalUserModel {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isDefault: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 获取存储键名
 * @param anonymousId - 匿名用户ID
 * @returns 完整的存储键名
 */
function getStorageKey(anonymousId: string): string {
  return `${STORAGE_KEY_PREFIX}${anonymousId}`;
}

/**
 * 获取本地模型列表
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
    console.error("获取本地模型失败:", error);
    return [];
  }
}

/**
 * 保存模型列表到本地存储
 * @param anonymousId - 匿名用户ID
 * @param models - 模型列表
 */
function saveLocalModels(anonymousId: string, models: LocalUserModel[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStorageKey(anonymousId);
    localStorage.setItem(key, JSON.stringify(models));
  } catch (error) {
    console.error("保存本地模型失败:", error);
    throw new Error("保存模型失败");
  }
}

/**
 * 添加本地模型
 * @param anonymousId - 匿名用户ID
 * @param model - 要添加的模型
 * @returns 更新后的模型列表
 */
export function addLocalModel(
  anonymousId: string,
  model: LocalUserModel
): LocalUserModel[] {
  const models = getLocalModels(anonymousId);

  // 如果新模型设为默认，取消其他模型的默认状态
  if (model.isDefault) {
    models.forEach((m) => {
      m.isDefault = false;
    });
  }

  // 添加时间戳
  const newModel: LocalUserModel = {
    ...model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  models.push(newModel);
  saveLocalModels(anonymousId, models);

  return models;
}

/**
 * 更新本地模型
 * @param anonymousId - 匿名用户ID
 * @param modelId - 要更新的模型ID
 * @param updates - 更新的字段
 * @returns 更新后的模型列表，如果模型不存在返回 null
 */
export function updateLocalModel(
  anonymousId: string,
  modelId: string,
  updates: Partial<LocalUserModel>
): LocalUserModel[] | null {
  const models = getLocalModels(anonymousId);
  const index = models.findIndex((m) => m.id === modelId);

  if (index === -1) {
    return null;
  }

  // 如果要设为默认，取消其他模型的默认状态
  if (updates.isDefault) {
    models.forEach((m) => {
      m.isDefault = false;
    });
  }

  // 更新模型
  models[index] = {
    ...models[index],
    ...updates,
    updatedAt: Date.now(),
  };

  saveLocalModels(anonymousId, models);
  return models;
}

/**
 * 删除本地模型
 * @param anonymousId - 匿名用户ID
 * @param modelId - 要删除的模型ID
 * @returns 更新后的模型列表，如果模型不存在返回 null
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

  models.splice(index, 1);
  saveLocalModels(anonymousId, models);

  return models;
}

/**
 * 设置默认模型
 * @param anonymousId - 匿名用户ID
 * @param modelId - 要设为默认的模型ID
 * @returns 更新后的模型列表，如果模型不存在返回 null
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

  // 取消所有模型的默认状态
  models.forEach((m) => {
    m.isDefault = false;
  });

  // 设置指定模型为默认
  models[index].isDefault = true;
  models[index].updatedAt = Date.now();

  saveLocalModels(anonymousId, models);
  return models;
}

/**
 * 获取默认模型
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
 * 同步后清空本地模型
 * 用于认证用户同步本地模型到云端后清理本地数据
 * @param anonymousId - 匿名用户ID
 */
export function clearModelsAfterSync(anonymousId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStorageKey(anonymousId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("清空本地模型失败:", error);
  }
}
