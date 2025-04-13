import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/header'
import { FeatureCard } from '@/app/protected/components/feature-card'

export default async function ProtectedPage() {
  const supabase = await createClient()

  // 获取用户信息
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    redirect('/auth/login')
  }

  // 获取功能数据
  const { data: functions, error } = await supabase
    .from('functions')
    .select('id, name, description, updated_at, url')
    .or(`is_public.eq.true,owner.eq.${userData.user.id}`)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching functions:', error)
  }

  // 检查用户是否为管理员
  const isAdmin = userData.user.email?.includes('admin') || false

  return (
    <div className="min-h-screen flex flex-col">
      <Header email={userData.user.email} isAdmin={isAdmin} />
      
      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold tracking-tight">
              欢迎使用
            </h1>
            <p className="mt-4 text-muted-foreground">
              选择下方功能卡片开始使用
            </p>
          </div>

          {/* 功能卡片列表 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {functions?.map((func) => (
              <FeatureCard
                key={func.id}
                id={func.id}
                name={func.name}
                description={func.description}
                updatedAt={func.updated_at}
                url={func.url}
              />
            ))}
            
            {!functions?.length && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                <svg 
                  className="w-12 h-12 mb-4 opacity-50" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" 
                  />
                </svg>
                <span>暂无可用功能</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
