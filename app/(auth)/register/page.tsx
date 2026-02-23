"use client";

/**
 * 注册页面
 * 路由 /register
 */

import { RegisterForm } from "@/components/auth/register-form";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <>
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <UserPlus className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">创建账号</h1>
        <p className="text-muted-foreground">注册新账号以解锁更多功能</p>
      </div>

      {/* 注册表单卡片 */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <RegisterForm
          onSuccess={() => router.push("/chat")}
          onSwitchToLogin={() => router.push("/login")}
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
