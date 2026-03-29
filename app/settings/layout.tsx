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

// 设置页面导航项配置
// showForAnonymous: 表示匿名用户是否可见该菜单项
const settingsNavItems = [
  { href: "/settings/models", label: "模型设置", icon: "🤖", showForAnonymous: false },
  { href: "/settings/agents", label: "Agent 配置", icon: "🧠", showForAnonymous: true }, // 匿名用户可用Agent
  { href: "/settings/skills", label: "Skill 管理", icon: "📝", showForAnonymous: false },
  { href: "/settings/tools", label: "工具管理", icon: "🔧", showForAnonymous: false },
  { href: "/settings/mcp", label: "MCP 服务器", icon: "🔌", showForAnonymous: false },
  { href: "/settings/api-keys", label: "API Key", icon: "🔑", showForAnonymous: false },
  { href: "/settings/files", label: "文件管理", icon: "📁", showForAnonymous: false }, // 新增：沙盒文件管理入口
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

  // 根据认证状态过滤菜单项
  // 已登录用户可以看到所有菜单，匿名用户只能看到 showForAnonymous 为 true 的菜单
  const visibleNavItems = settingsNavItems.filter(
    (item) => isAuthenticated || item.showForAnonymous
  );

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
            {/* 渲染过滤后的菜单项 */}
            {visibleNavItems.map((item) => (
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
