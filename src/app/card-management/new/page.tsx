import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FunctionForm } from '../components/function-form'

export default async function NewFunctionPage() {
  const supabase = await createClient()
  
  // 验证用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 创建服务端提交动作
  const createFunction = async (formData: any) => {
    'use server'
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { error: '未认证用户' }

    const { error } = await supabase
      .from('functions')
      .insert({
        ...formData,
        owner: user.id,
        updated_at: new Date().toISOString()
      })

    if (error) return { error: error.message }
    redirect('/card-management')
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-8">创建新功能卡片</h2>
      <FunctionForm onSubmit={createFunction} />
    </div>
  )
}