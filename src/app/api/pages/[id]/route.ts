import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 获取单个页面
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('static_pages')
      .select('*')
      .eq('id', id)
      .eq('owner', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: '未找到页面' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 更新页面
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { title, content } = await request.json()
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 })
    }

    // 验证页面所有权
    const { data: existing, error: findError } = await supabase
      .from('static_pages')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '未找到页面' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('static_pages')
      .update({ title, content })
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

// 删除页面
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    // 验证页面所有权
    const { data: existing, error: findError } = await supabase
      .from('static_pages')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '未找到页面' }, { status: 404 })
    }

    const { error } = await supabase
      .from('static_pages')
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