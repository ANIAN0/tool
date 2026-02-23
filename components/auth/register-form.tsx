"use client";

/**
 * 注册表单组件
 * 处理用户注册逻辑，包括表单验证、邀请码验证和API调用
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAnonId, setAnonId } from "@/lib/anon-id";
import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// 注册表单数据类型
interface RegisterFormData {
  username: string;
  password: string;
  confirmPassword: string;
  inviteCode: string;
}

// 注册表单组件Props
interface RegisterFormProps {
  // 注册成功后的回调
  onSuccess?: () => void;
  // 跳转到登录页面的回调
  onSwitchToLogin?: () => void;
}

/**
 * 注册表单组件
 */
export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter();

  // 表单数据
  const [formData, setFormData] = useState<RegisterFormData>({
    username: "",
    password: "",
    confirmPassword: "",
    inviteCode: "",
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

  // 验证表单
  const validateForm = (): boolean => {
    // 验证必填字段
    if (!formData.username || !formData.password || !formData.confirmPassword || !formData.inviteCode) {
      setError("请填写所有必填项");
      return false;
    }

    // 验证用户名长度
    if (formData.username.length < 3 || formData.username.length > 20) {
      setError("用户名长度应为3-20位");
      return false;
    }

    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError("用户名只能包含字母、数字和下划线");
      return false;
    }

    // 验证用户名不能以数字开头
    if (/^\d/.test(formData.username)) {
      setError("用户名不能以数字开头");
      return false;
    }

    // 验证密码长度
    if (formData.password.length < 8) {
      setError("密码长度至少8位");
      return false;
    }

    // 验证密码强度
    if (!/\d/.test(formData.password) || !/[a-zA-Z]/.test(formData.password)) {
      setError("密码必须包含字母和数字");
      return false;
    }

    // 验证两次密码一致
    if (formData.password !== formData.confirmPassword) {
      setError("两次输入的密码不一致");
      return false;
    }

    return true;
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证表单
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 获取当前匿名用户ID
      const anonymousId = getAnonId();

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          inviteCode: formData.inviteCode,
          anonymousId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "注册失败");
        return;
      }

      // 存储令牌到 localStorage
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("userId", data.user.id);
      
      // 更新本地用户ID为注册用户的ID（场景1：保留原匿名ID 或 场景2：登录已有用户）
      // 这样后续请求将使用新的用户ID
      setAnonId(data.user.id);

      // 调用成功回调或跳转
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/chat");
      }
    } catch (err) {
      setError("注册失败，请稍后重试");
      console.error("注册失败:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 用户名输入 */}
      <div className="space-y-2">
        <Label htmlFor="register-username">用户名</Label>
        <Input
          id="register-username"
          name="username"
          type="text"
          placeholder="3-20位字母、数字或下划线"
          value={formData.username}
          onChange={handleChange}
          disabled={isLoading}
          autoComplete="username"
        />
      </div>

      {/* 密码输入 */}
      <div className="space-y-2">
        <Label htmlFor="register-password">密码</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          placeholder="至少8位，包含字母和数字"
          value={formData.password}
          onChange={handleChange}
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      {/* 确认密码输入 */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认密码</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          value={formData.confirmPassword}
          onChange={handleChange}
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      {/* 邀请码输入 */}
      <div className="space-y-2">
        <Label htmlFor="inviteCode">邀请码</Label>
        <Input
          id="inviteCode"
          name="inviteCode"
          type="text"
          placeholder="请输入邀请码"
          value={formData.inviteCode}
          onChange={handleChange}
          disabled={isLoading}
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
            注册中...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            注册
          </>
        )}
      </Button>

      {/* 切换到登录 */}
      {onSwitchToLogin && (
        <div className="text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary hover:underline cursor-pointer"
          >
            立即登录
          </button>
        </div>
      )}
    </form>
  );
}
