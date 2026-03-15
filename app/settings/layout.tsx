/**
 * 设置页面布局
 * 提供统一的设置页面导航和布局结构
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// 设置页面导航项
const settingsNavItems = [
  { href: "/settings/models", label: "模型设置", icon: "🤖" },
  { href: "/settings/profile", label: "个人资料", icon: "👤" },
];

interface SettingsLayoutProps {
  children: ReactNode;
}

/**
 * 设置页面布局组件
 */
export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* 侧边导航栏 */}
      <aside className="w-64 border-r bg-muted/30">
        <div className="p-4">
          <h2 className="mb-4 text-lg font-semibold">设置</h2>
          <nav className="space-y-1">
            {settingsNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "focus:bg-muted focus:text-foreground focus:outline-none"
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
