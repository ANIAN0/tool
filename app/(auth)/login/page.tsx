"use client";

/**
 * 登录页面
 * 路由 /login
 */

import { LoginForm } from "@/components/auth/login-form";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <>
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <LogIn className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">欢迎回来</h1>
        <p className="text-muted-foreground">登录您的账号以继续使用</p>
      </div>

      {/* 登录表单卡片 */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <LoginForm
          onSuccess={() => router.push("/chat")}
          onSwitchToRegister={() => router.push("/register")}
        />
      </div>

      {/* 游客访问 */}
      <div className="text-center">
        <Link
          href="/chat"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          以游客身份继续
        </Link>
      </div>
    </>
  );
}
