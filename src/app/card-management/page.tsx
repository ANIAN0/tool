import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
// 修改导入语句
import { DataTable } from '@/app/card-management/components/data-table/data-table'
import { columns } from '@/app/card-management/components/data-table/columns'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function CardManagementPage() {
  const supabase = await createClient()

  try {
    // 认证检查
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw new Error('认证失败: ' + authError.message)
    if (!user) redirect('/login')

    // 获取功能数据（包含创建人信息）
    const { data: functions, error: queryError } = await supabase
      .from('functions')
      .select(`
        id, 
        name, 
        description, 
        updated_at, 
        sort_order, 
        url, 
        is_public,
        owner
      `)
      .or(`is_public.eq.true,owner.eq.${user.id}`)
      .order('sort_order')
    
    if (queryError) {
      console.error("数据查询错误:", queryError)
      throw new Error('数据获取失败: ' + queryError.message)
    }

    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/protected">返回首页</Link>
            </Button>
            <h1 className="text-3xl font-bold">功能卡片管理</h1>
          </div>
          <Button asChild>
            <Link href="/card-management/new">新建卡片</Link>
          </Button>
        </div>
        
        <DataTable
          columns={columns}
          data={functions || []}
          currentUserId={user.id}
        />
      </div>
    )
  } catch (error) {
    console.error("数据获取错误:", error)
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="text-center text-red-500">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      </div>
    )
  }
}