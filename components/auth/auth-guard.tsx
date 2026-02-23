"use client";

/**
 * 认证守卫组件
 * 检查用户是否有权限访问私有资源
 */

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";

// AuthGuard Props
interface AuthGuardProps {
  // 是否需要登录
  requiresAuth: boolean;
  // 子组件
  children: ReactNode;
  // 未授权时的回调
  onUnauthorized?: () => void;
}

/**
 * 认证守卫组件
 * 如果需要登录但用户未登录，则重定向到登录页
 */
export function AuthGuard({ requiresAuth, children, onUnauthorized }: AuthGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);
  
  // 使用 ref 存储 onUnauthorized 回调，避免 useEffect 依赖变化导致重复执行
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  useEffect(() => {
    // 不需要认证，直接通过
    if (!requiresAuth) {
      setIsAuthorized(true);
      setIsChecking(false);
      return;
    }

    // 检查认证状态
    const checkAuth = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");

        if (!accessToken) {
          // 未登录
          setIsAuthorized(false);
          setIsChecking(false);

          if (onUnauthorizedRef.current) {
            onUnauthorizedRef.current();
          } else {
            router.push("/login");
          }
          return;
        }

        // 验证令牌
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          // 令牌无效
          setIsAuthorized(false);
          setIsChecking(false);

          if (onUnauthorizedRef.current) {
            onUnauthorizedRef.current();
          } else {
            router.push("/login");
          }
          return;
        }

        const data = await response.json();

        if (data.success && !data.user.isAnonymous) {
          // 已登录
          setIsAuthorized(true);
        } else {
          // 匿名用户
          setIsAuthorized(false);

          if (onUnauthorizedRef.current) {
            onUnauthorizedRef.current();
          } else {
            router.push("/login");
          }
        }
      } catch (error) {
        console.error("认证检查失败:", error);
        setIsAuthorized(false);

        if (onUnauthorizedRef.current) {
          onUnauthorizedRef.current();
        } else {
          router.push("/login");
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [requiresAuth, router]);

  // 正在检查认证状态
  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">验证身份中...</p>
        </div>
      </div>
    );
  }

  // 未授权
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">正在跳转到登录页面...</p>
        </div>
      </div>
    );
  }

  // 授权通过
  return <>{children}</>;
}
