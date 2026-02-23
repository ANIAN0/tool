"use client";

/**
 * 认证上下文Provider
 * 在整个应用中提供认证状态
 */

import { createContext, useContext, ReactNode } from "react";
import { useAuth, type AuthUser, type AuthState } from "@/lib/hooks/use-auth";

// 认证上下文类型
interface AuthContextValue extends AuthState {
  user: AuthUser | null;
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
  getAuthHeader: () => Record<string, string>;
  checkAuth: (requiresAuth: boolean) => boolean;
  refreshAccessToken: () => Promise<string | null>;
}

// 创建上下文
const AuthContext = createContext<AuthContextValue | null>(null);

// Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 认证Provider组件
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 使用认证上下文的Hook
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}
