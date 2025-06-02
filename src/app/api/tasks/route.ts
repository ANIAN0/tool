import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 创建新任务
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { content, description, type, is_important, is_urgent, start_date, end_date } = await request.json()
    
    // 验证必填字段
    if (!content?.trim()) {
      return NextResponse.json({ error: '任务内容不能为空' }, { status: 400 })
    }
    if (!type) {
      return NextResponse.json({ error: '任务类型不能为空' }, { status: 400 })
    }
    if (!start_date || !end_date) {
      return NextResponse.json({ error: '开始日期和结束日期不能为空' }, { status: 400 })
    }
    if (typeof is_important !== 'boolean' || typeof is_urgent !== 'boolean') {
      return NextResponse.json({ error: '重要性和紧急性必须为布尔值' }, { status: 400 })
    }
    if (!['工作', '学习', '复盘'].includes(type)) {
      return NextResponse.json({ error: '任务类型必须为：工作、学习、复盘' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        content,
        description: description || null,
        type,
        is_important,
        is_urgent,
        start_date,
        end_date,
        owner: user.id
      })
      .select()
      .single()

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

// 获取任务列表
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const type = searchParams.get('type')
    const is_important = searchParams.get('is_important')
    const is_urgent = searchParams.get('is_urgent')

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('owner', user.id)
      .order('created_at', { ascending: false })

    // 添加过滤条件
    if (start_date) {
      query = query.gte('start_date', start_date)
    }
    if (end_date) {
      query = query.lte('end_date', end_date)
    }
    if (type) {
      query = query.eq('type', type)
    }
    if (is_important !== null) {
      query = query.eq('is_important', is_important === 'true')
    }
    if (is_urgent !== null) {
      query = query.eq('is_urgent', is_urgent === 'true')
    }

    const { data, error } = await query

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