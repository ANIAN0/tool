import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User } from "@supabase/supabase-js"

interface UserAuthSectionProps {
  user: User | null
}

export default function UserAuthSection({ user }: UserAuthSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>用户认证标准实现</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">当前用户状态</h3>
            <div className="p-4 rounded-md bg-muted">
              {user ? (
                <div>
                  <p><strong>用户ID:</strong> {user.id}</p>
                  <p><strong>邮箱:</strong> {user.email}</p>
                  <p><strong>上次登录:</strong> {new Date(user.last_sign_in_at || '').toLocaleString()}</p>
                </div>
              ) : (
                <p>未登录</p>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">实现说明</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>使用 <code>createClient()</code> 创建 Supabase 客户端</li>
              <li>通过 <code>supabase.auth.getSession()</code> 获取当前会话</li>
              <li>使用 <code>onAuthStateChange</code> 监听认证状态变化</li>
              <li>将用户信息存储在 React 状态中</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}