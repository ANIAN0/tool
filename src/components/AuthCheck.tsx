'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lock } from 'lucide-react';

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  // 检查是否已登录
  useEffect(() => {
    const token = localStorage.getItem('api-docs-token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  // 登录验证
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://124.156.205.61:5678/webhook/82a78108-5dbf-47e5-bf41-222ac0b408e3', {
        method: 'GET',
        headers: {
          'password': password
        }
      });
      
      if (response.ok) {
        const result = await response.text();
        if (result === '通过') {
          localStorage.setItem('api-docs-token', 'authenticated');
          setIsLoggedIn(true);
        } else {
          setError(result || '密码错误');
        }
      } else {
        setError('网络错误');
      }
    } catch (error: any) {
      setError(error.message || '请求异常');
    } finally {
      setIsLoading(false);
    }
  };

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('api-docs-token');
    setIsLoggedIn(false);
    setPassword('');
  };

  // 如果已登录，显示子组件
  if (isLoggedIn) {
    return <>{children}</>;
  }

  // 未登录状态，显示登录表单
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            API 文档访问认证
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="请输入访问密码"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  验证中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>请输入密码以访问 API 文档</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}