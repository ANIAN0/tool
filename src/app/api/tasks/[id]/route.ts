import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 获取单个任务详情
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('owner', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 更新任务
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
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

    // 验证任务所有权
    const { data: existing, error: findError } = await supabase
      .from('tasks')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '无权修改此任务' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({
        content,
        description: description || null,
        type,
        is_important,
        is_urgent,
        start_date,
        end_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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

// 删除任务
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    // 验证任务所有权
    const { data: existing, error: findError } = await supabase
      .from('tasks')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '无权删除此任务' }, { status: 403 })
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}