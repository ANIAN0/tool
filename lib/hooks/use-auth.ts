"use client";

/**
 * 认证状态管理Hook
 * 管理登录状态、令牌存储、自动刷新和登出
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 用户信息类型
export interface AuthUser {
  id: string;
  username: string | null;
  isAnonymous: boolean;
  createdAt: number;
}

// 认证状态类型
export interface AuthState {
  // 用户信息
  user: AuthUser | null;
  // 是否已登录（非匿名用户）
  isAuthenticated: boolean;
  // 是否正在加载
  isLoading: boolean;
  // 访问令牌
  accessToken: string | null;
}

// localStorage 存储键
const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  USER_ID: "userId",
  CACHE_VERSION: "authCacheVersion",
};

// 缓存版本号，用于清理旧格式的存储
const CACHE_VERSION = "1";

// 带缓存的 token 存储
interface CachedTokens {
  accessToken: string | null;
  refreshToken: string | null;
  cachedAt: number;
}

// 内存缓存，避免频繁读取 localStorage
let tokensCache: CachedTokens | null = null;
let cacheInitialized = false;

/**
 * 获取 token（带缓存）
 * 使用内存缓存减少 localStorage 读取
 */
function getTokensFromStorage(): CachedTokens {
  // 如果缓存已初始化，直接返回缓存
  if (cacheInitialized && tokensCache) {
    return tokensCache;
  }

  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, cachedAt: 0 };
  }

  // 检查缓存版本，版本不一致时清除旧缓存
  const storedVersion = localStorage.getItem(STORAGE_KEYS.CACHE_VERSION);
  if (storedVersion !== CACHE_VERSION) {
    // 版本不一致，清理旧存储
    localStorage.setItem(STORAGE_KEYS.CACHE_VERSION, CACHE_VERSION);
    tokensCache = { accessToken: null, refreshToken: null, cachedAt: Date.now() };
    cacheInitialized = true;
    return tokensCache;
  }

  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

  tokensCache = {
    accessToken,
    refreshToken,
    cachedAt: Date.now(),
  };
  cacheInitialized = true;

  return tokensCache;
}

/**
 * 认证状态管理Hook
 */
export function useAuth() {
  const router = useRouter();

  // 认证状态
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    accessToken: null,
  });

  // 从 localStorage 加载令牌（带缓存）
  const loadTokens = useCallback(() => {
    return getTokensFromStorage();
  }, []);

  // 保存令牌到 localStorage
  const saveTokens = useCallback((accessToken: string, refreshToken: string) => {
    if (typeof window === "undefined") return;

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    
    // 更新内存缓存
    tokensCache = {
      accessToken,
      refreshToken,
      cachedAt: Date.now(),
    };
  }, []);

  // 清除令牌
  const clearTokens = useCallback(() => {
    if (typeof window === "undefined") return;

    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    
    // 清空内存缓存
    tokensCache = { accessToken: null, refreshToken: null, cachedAt: Date.now() };
  }, []);

  // 获取用户信息
  const fetchUser = useCallback(async (accessToken: string): Promise<AuthUser | null> => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.success ? data.user : null;
    } catch (error) {
      console.error("获取用户信息失败:", error);
      return null;
    }
  }, []);

  // 刷新访问令牌
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const { refreshToken } = loadTokens();

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
      saveTokens(data.accessToken, data.refreshToken);

      return data.accessToken;
    } catch (error) {
      console.error("刷新令牌失败:", error);
      return null;
    }
  }, [loadTokens, saveTokens]);

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      const { accessToken } = loadTokens();

      if (!accessToken) {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          accessToken: null,
        });
        return;
      }

      // 尝试获取用户信息
      let user = await fetchUser(accessToken);

      if (!user) {
        // 访问令牌可能已过期，尝试刷新
        const newAccessToken = await refreshAccessToken();

        if (newAccessToken) {
          user = await fetchUser(newAccessToken);

          if (user) {
            setState({
              user,
              isAuthenticated: !user.isAnonymous,
              isLoading: false,
              accessToken: newAccessToken,
            });
            return;
          }
        }

        // 刷新失败，清除状态
        clearTokens();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          accessToken: null,
        });
        return;
      }

      setState({
        user,
        isAuthenticated: !user.isAnonymous,
        isLoading: false,
        accessToken,
      });
    };

    initAuth();
  }, [fetchUser, loadTokens, refreshAccessToken, clearTokens]);

  // 登出
  const logout = useCallback(() => {
    clearTokens();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
    });
    router.push("/login");
  }, [clearTokens, router]);

  // 登录成功后更新状态
  const login = useCallback((accessToken: string, refreshToken: string, user: AuthUser) => {
    saveTokens(accessToken, refreshToken);
    setState({
      user,
      isAuthenticated: !user.isAnonymous,
      isLoading: false,
      accessToken,
    });
  }, [saveTokens]);

  // 获取认证头（用于API请求）
  const getAuthHeader = useCallback((): Record<string, string> => {
    const { accessToken } = state;
    if (accessToken) {
      return { Authorization: `Bearer ${accessToken}` };
    }
    return {};
  }, [state]);

  // 检查是否需要登录（用于私有Agent）
  const checkAuth = useCallback((requiresAuth: boolean): boolean => {
    if (!requiresAuth) return true;
    return state.isAuthenticated;
  }, [state.isAuthenticated]);

  return {
    ...state,
    login,
    logout,
    getAuthHeader,
    checkAuth,
    refreshAccessToken,
  };
}
