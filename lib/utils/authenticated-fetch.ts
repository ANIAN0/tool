/**
 * 带认证的 fetch 工具函数
 * 自动附加 Authorization 头，并在令牌过期时自动刷新重试
 * 供客户端组件在非 Hook 场景下使用
 */

// localStorage 存储键（与 useAuth hook 保持一致）
const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
};

/**
 * 从 localStorage 获取访问令牌
 */
function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * 从 localStorage 获取刷新令牌
 */
function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * 保存新的访问令牌到 localStorage
 */
function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
}

/**
 * 调用后端接口刷新访问令牌
 */
async function doRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.accessToken) return null;

    // 保存新令牌
    setAccessToken(data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    }

    return data.accessToken as string;
  } catch (error) {
    console.error("刷新令牌失败:", error);
    return null;
  }
}

/**
 * 带自动刷新功能的认证请求函数
 * 当返回 401 且为 TOKEN_EXPIRED 时，自动刷新令牌并重试一次
 *
 * @param url - 请求地址
 * @param options - fetch 选项
 * @returns fetch 响应
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = getAccessToken();

  // 合并认证头
  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  };

  // 第一次请求
  let response = await fetch(url, mergedOptions);

  // 处理 401 令牌过期，尝试自动刷新并重试
  if (response.status === 401) {
    try {
      const data = await response.clone().json();
      if (data.code === "TOKEN_EXPIRED" || data.error === "访问令牌已过期") {
        const newAccessToken = await doRefreshToken();
        if (newAccessToken) {
          const retryOptions: RequestInit = {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${newAccessToken}`,
            },
          };
          response = await fetch(url, retryOptions);
        }
      }
    } catch {
      // 解析失败，保留原始响应
    }
  }

  return response;
}
