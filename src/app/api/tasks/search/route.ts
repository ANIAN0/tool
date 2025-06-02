import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 搜索任务
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword')
    
    if (!keyword?.trim()) {
      return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 })
    }

    // 使用 ilike 进行模糊搜索，搜索任务内容和描述
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('owner', user.id)
      .or(`content.ilike.%${keyword}%,description.ilike.%${keyword}%`)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}