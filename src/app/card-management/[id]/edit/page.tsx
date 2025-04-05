import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
// 修正组件导入路径为实际位置
import { FunctionForm } from '../../components/function-form'

export default async function EditPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  // 验证用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 获取功能数据（添加类型断言）
  const { data: func } = await supabase
    .from('functions')
    .select('*')
    .eq('id', params.id)
    .eq('owner', user.id)
    .single() as { data: any }

  if (!func) redirect('/card-management')

  // 创建服务端提交动作
  const updateFunction = async (formData: any) => {
    'use server'
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { error: '未认证用户' }

    const { error } = await supabase
      .from('functions')
      .update({
        ...formData,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (error) return { error: error.message }
    redirect('/card-management')
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-8">编辑功能卡片</h2>
      <FunctionForm 
        initialData={func}
        onSubmit={updateFunction} // 传递服务端动作
      />
    </div>
  )
}