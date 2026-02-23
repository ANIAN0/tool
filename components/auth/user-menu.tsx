"use client";

/**
 * 用户菜单组件
 * 在header中显示用户状态和操作菜单
 */

import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/components/auth/auth-provider";
import { LogIn, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 用户菜单组件
 */
export function UserMenu() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 未登录状态 - 显示登录按钮
  if (!isAuthenticated) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/login")}
        className="gap-2"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">登录</span>
      </Button>
    );
  }

  // 已登录状态 - 显示用户菜单
  return (
    <div className="relative">
      {/* 用户按钮 */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
      >
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium hidden sm:inline">
          {user?.username || "用户"}
        </span>
      </button>

      {/* 下拉菜单 */}
      {isMenuOpen && (
        <>
          {/* 点击遮罩关闭菜单 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* 菜单内容 */}
          <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-card shadow-lg z-50">
            {/* 用户信息 */}
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">
                {user?.username || "用户"}
              </p>
              <p className="text-xs text-muted-foreground">已登录</p>
            </div>

            {/* 登出按钮 */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
}
