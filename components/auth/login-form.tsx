"use client";

/**
 * 登录表单组件
 * 处理用户登录逻辑，包括表单验证和API调用
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAnonId } from "@/lib/anon-id";
import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// 登录表单数据类型
interface LoginFormData {
  username: string;
  password: string;
}

// 登录表单组件Props
interface LoginFormProps {
  // 登录成功后的回调
  onSuccess?: () => void;
  // 跳转到注册页面的回调
  onSwitchToRegister?: () => void;
}

/**
 * 登录表单组件
 */
export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const router = useRouter();

  // 表单数据
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 处理输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // 清除错误
    setError(null);
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证必填字段
    if (!formData.username || !formData.password) {
      setError("请输入用户名和密码");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "登录失败");
        return;
      }

      // 存储令牌到 localStorage
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("userId", data.user.id);
      
      // 更新本地用户ID为登录用户的ID（场景2：登录已有用户）
      // 这样后续请求将使用新的用户ID
      setAnonId(data.user.id);

      // 调用成功回调或跳转
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/chat");
      }
    } catch (err) {
      setError("登录失败，请稍后重试");
      console.error("登录失败:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 用户名输入 */}
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input
          id="username"
          name="username"
          type="text"
          placeholder="请输入用户名"
          value={formData.username}
          onChange={handleChange}
          disabled={isLoading}
          autoComplete="username"
        />
      </div>

      {/* 密码输入 */}
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="请输入密码"
          value={formData.password}
          onChange={handleChange}
          disabled={isLoading}
          autoComplete="current-password"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 提交按钮 */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            登录中...
          </>
        ) : (
          <>
            <LogIn className="w-4 h-4" />
            登录
          </>
        )}
      </Button>

      {/* 切换到注册 */}
      {onSwitchToRegister && (
        <div className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-primary hover:underline cursor-pointer"
          >
            立即注册
          </button>
        </div>
      )}
    </form>
  );
}
