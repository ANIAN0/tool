import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ProtectedPage() {
  const supabase = await createClient()

  // 获取用户信息
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    redirect('/login')
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">
          Welcome {userData.user.email}
        </h1>
        <LogoutButton />
      </div>

      {/* 功能卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {functions?.map((func) => (
          <Link
            key={func.id}
            href={func.url}
            target="_blank"
            className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold mb-2">{func.name}</h3>
            {func.description && (
              <p className="text-gray-600 mb-4">{func.description}</p>
            )}
            <p className="text-sm text-gray-500">
              Updated: {new Date(func.updated_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
        
        {!functions?.length && (
          <div className="col-span-full text-center text-gray-500">
            No functions available
          </div>
        )}
      </div>
    </div>
  )
}
