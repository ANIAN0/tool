/**
 * 认证请求工具函数
 * 提供带自动令牌刷新的 fetch 封装
 */

import { getAnonId } from "@/lib/anon-id";

// localStorage 存储键
const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
};

/**
 * 从 localStorage 获取令牌
 */
function getTokensFromStorage() {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }

  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

  return { accessToken, refreshToken };
}

/**
 * 保存令牌到 localStorage
 */
function saveTokensToStorage(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
}

/**
 * 刷新访问令牌
 * @returns 新的访问令牌，失败返回 null
 */
async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getTokensFromStorage();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      return null;
    }

    // 保存新令牌
    saveTokensToStorage(data.accessToken, data.refreshToken);

    return data.accessToken;
  } catch (error) {
    console.error("刷新令牌失败:", error);
    return null;
  }
}

/**
 * 构建认证请求头
 */
function buildAuthHeader(accessToken: string | null): Record<string, string> {
  // 已登录用户使用 JWT Token
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  // 未登录用户使用匿名 ID
  const anonId = getAnonId();
  if (anonId) {
    return { "X-Anonymous-Id": anonId };
  }

  return {};
}

/**
 * 带自动刷新的认证请求函数
 * 当访问令牌过期时（401 + TOKEN_EXPIRED），自动刷新令牌并重试请求
 *
 * @param url - 请求URL
 * @param options - fetch选项
 * @returns fetch响应结果
 *
 * @example
 * // 基本使用
 * const response = await authenticatedFetch("/api/skills", { method: "POST", body: formData });
 *
 * @example
 * // 带额外headers
 * const response = await authenticatedFetch("/api/agents", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify(data),
 * });
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 获取当前令牌
  const { accessToken } = getTokensFromStorage();

  // 构建认证头
  const authHeader = buildAuthHeader(accessToken);

  // 合并认证头到请求选项
  // 注意：如果是 FormData，不要设置 Content-Type，让浏览器自动处理
  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
      ...authHeader,
    },
  };

  // 第一次请求
  let response = await fetch(url, mergedOptions);

  // 如果返回401，检查是否是令牌过期错误
  if (response.status === 401) {
    try {
      const data = await response.clone().json();

      // 检查是否是令牌过期错误
      if (data.code === "TOKEN_EXPIRED" || data.error === "访问令牌已过期") {
        // 尝试刷新令牌
        const newAccessToken = await refreshAccessToken();

        if (newAccessToken) {
          // 使用新令牌重新构建请求头
          const newAuthHeader = buildAuthHeader(newAccessToken);
          const retryOptions: RequestInit = {
            ...options,
            headers: {
              ...options.headers,
              ...newAuthHeader,
            },
          };

          // 重试请求
          response = await fetch(url, retryOptions);
        }
      }
    } catch (parseError) {
      // JSON解析失败，记录警告并返回原始响应
      console.warn('[authenticatedFetch] 响应非JSON格式，返回原始响应:', parseError);
    }
  }

  return response;
}

/**
 * 获取认证请求头（用于需要手动构建 headers 的场景）
 * 注意：此函数不包含自动刷新逻辑，建议优先使用 authenticatedFetch
 *
 * @returns 认证请求头对象
 *
 * @deprecated 建议使用 authenticatedFetch 替代，以获得自动令牌刷新功能
 */
export function getAuthHeader(): Record<string, string> {
  const { accessToken } = getTokensFromStorage();
  return buildAuthHeader(accessToken);
}