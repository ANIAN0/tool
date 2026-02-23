/**
 * 认证页面布局
 * 提供居中卡片容器，用于登录和注册页面
 */

import { MessageSquare } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 顶部导航 */}
      <header className="h-16 shrink-0 border-b border-border flex items-center px-6">
        <Link href="/chat" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          <MessageSquare className="w-6 h-6" />
          <span className="font-semibold">AI 对话助手</span>
        </Link>
      </header>

      {/* 主内容区域 - 居中卡片 */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {children}
        </div>
      </main>

      {/* 底部信息 */}
      <footer className="shrink-0 py-4 text-center text-sm text-muted-foreground">
        <p>AI 对话助手 - 基于 Next.js 和 AI SDK</p>
      </footer>
    </div>
  );
}
