import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 创建文件记录
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const body = await request.json()
    const { name, path, size, type, public_url } = body

    // 验证必填字段
    if (!name || !path) {
      return NextResponse.json({ error: '名称和路径为必填项' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('files')
      .insert({
        name,
        path,
        size,
        type,
        user_id: user.id,
        user_email: user.email,
        public_url
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('创建文件记录失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 获取文件列表
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('获取文件列表失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}