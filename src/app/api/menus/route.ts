import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 获取菜单列表
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    // 查询活跃的菜单，按排序顺序排列
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

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

// 创建新菜单
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { name, url, icon, parent_id, sort_order } = await request.json()
    
    // 验证必填字段
    if (!name?.trim()) {
      return NextResponse.json({ error: '菜单名称不能为空' }, { status: 400 })
    }
    if (!url?.trim()) {
      return NextResponse.json({ error: '菜单URL不能为空' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('menus')
      .insert({
        name,
        url,
        icon: icon || null,
        parent_id: parent_id || null,
        sort_order: sort_order || 0,
        is_active: true,
        created_by: user.id
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