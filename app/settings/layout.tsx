"use client";

/**
 * 设置页面布局
 * 提供统一的设置页面导航和布局结构
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/components/auth/auth-provider";
import { User } from "lucide-react";

// 设置页面导航项
const settingsNavItems = [
  { href: "/settings/models", label: "模型设置", icon: "🤖" },
  { href: "/settings/tools", label: "工具管理", icon: "🔧" },
  { href: "/settings/mcp", label: "MCP 服务器", icon: "🔌" },
];

interface SettingsLayoutProps {
  children: ReactNode;
}

/**
 * 设置页面布局组件
 */
export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const { user, isAuthenticated } = useAuthContext();
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* 侧边导航栏 */}
      <aside className="w-64 border-r bg-muted/30">
        <div className="p-4">
          {/* 用户信息卡片 */}
          {isAuthenticated && user && (
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.username || "用户"}
                  </p>
                  <p className="text-xs text-muted-foreground">已登录</p>
                </div>
              </div>
            </div>
          )}

          <h2 className="mb-4 text-lg font-semibold">设置</h2>
          <nav className="space-y-1">
            {settingsNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "focus:bg-muted focus:text-foreground focus:outline-none",
                  pathname === item.href && "bg-muted text-foreground"
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-6">{children}</div>
      </main>
    </div>
  );
}
