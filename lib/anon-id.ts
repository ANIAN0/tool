import { nanoid } from "nanoid";

/**
 * 匿名ID的localStorage存储key
 */
const ANON_ID_KEY = "agent_anon_id";

/**
 * 检查是否在浏览器环境中
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * 获取匿名用户ID
 * - 如果localStorage中已存在，直接返回
 * - 如果不存在，生成新ID并存储到localStorage
 * 
 * @returns 匿名用户ID，如果不在浏览器环境则返回null
 */
export function getAnonId(): string | null {
  // 检查是否在浏览器环境
  if (!isBrowser()) {
    return null;
  }

  // 尝试从localStorage获取已有ID
  const existingId = localStorage.getItem(ANON_ID_KEY);
  if (existingId) {
    return existingId;
  }

  // 生成新的匿名ID（使用nanoid，长度21，足够唯一）
  const newId = nanoid();
  
  // 存储到localStorage
  localStorage.setItem(ANON_ID_KEY, newId);
  
  return newId;
}

/**
 * 生成新的匿名用户ID（强制重新生成）
 * 用于测试或特殊场景
 * 
 * @returns 新生成的匿名用户ID
 */
export function regenerateAnonId(): string | null {
  // 检查是否在浏览器环境
  if (!isBrowser()) {
    return null;
  }

  // 生成新的匿名ID
  const newId = nanoid();
  
  // 存储到localStorage
  localStorage.setItem(ANON_ID_KEY, newId);
  
  return newId;
}

/**
 * 设置匿名用户ID
 * 用于登录/注册后更新用户ID
 * 
 * @param id - 要设置的用户ID
 */
export function setAnonId(id: string): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.setItem(ANON_ID_KEY, id);
}

/**
 * 清除匿名用户ID（用于测试）
 */
export function clearAnonId(): void {
  // 检查是否在浏览器环境
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(ANON_ID_KEY);
}
