import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 获取所有功能卡片
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isPublicOnly = searchParams.get('public') === 'true'
    
    // 构建查询
    let query = supabase
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
    
    // 根据查询参数过滤
    if (isPublicOnly) {
      query = query.eq('is_public', true)
    } else {
      query = query.or(`is_public.eq.true,owner.eq.${user.id}`)
    }
    
    const { data, error } = await query.order('sort_order')

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

// 创建新功能卡片
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const formData = await request.json()
    
    // 验证必填字段
    if (!formData.name || !formData.url) {
      return NextResponse.json({ error: '名称和URL为必填项' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('functions')
      .insert({
        ...formData,
        owner: user.id,
        updated_at: new Date().toISOString()
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