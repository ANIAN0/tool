import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 更新笔记
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { content } = await request.json()
    if (!content?.trim()) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
    }

    // 验证记录所有权
    const { data: existing, error: findError } = await supabase
      .from('temporary_contents')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '未找到记录' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('temporary_contents')
      .update({ content })
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

// 删除笔记
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    // 验证记录所有权
    const { data: existing, error: findError } = await supabase
      .from('temporary_contents')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '未找到记录' }, { status: 404 })
    }

    const { error } = await supabase
      .from('temporary_contents')
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