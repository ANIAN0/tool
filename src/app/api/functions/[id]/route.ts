import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 获取单个功能卡片
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('functions')
      .select('*')
      .or(`is_public.eq.true,owner.eq.${user.id}`)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: '未找到记录' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 更新功能卡片
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const formData = await request.json()
    
    // 验证必填字段
    if (!formData.name || !formData.url) {
      return NextResponse.json({ error: '名称和URL为必填项' }, { status: 400 })
    }

    // 验证记录所有权
    const { data: existing, error: findError } = await supabase
      .from('functions')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '未找到记录或无权限修改' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('functions')
      .update({
        ...formData,
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

// 删除功能卡片
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
      .from('functions')
      .select('owner')
      .eq('id', id)
      .single()

    if (findError || existing?.owner !== user.id) {
      return NextResponse.json({ error: '未找到记录或无权限删除' }, { status: 404 })
    }

    const { error } = await supabase
      .from('functions')
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