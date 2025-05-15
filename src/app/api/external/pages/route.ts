import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// 从请求头中获取access token
function getAccessToken(request: Request) {
  const authHeader = request.headers.get('Authorization')
  console.log('Auth header:', authHeader) // 添加日志
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.split(' ')[1]
}

// 获取页面列表
export async function GET(request: Request) {
  try {
    console.log('Received GET request') // 添加日志
    const accessToken = getAccessToken(request)
    if (!accessToken) {
      console.log('No access token provided') // 添加日志
      return NextResponse.json({ error: '未提供认证token' }, { status: 401 })
    }

    console.log('Creating Supabase client') // 添加日志
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return null
          },
          set(name: string, value: string, options: any) {
            // 不需要设置 cookie
          },
          remove(name: string, options: any) {
            // 不需要删除 cookie
          },
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    )

    console.log('Getting user with token') // 添加日志
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (authError) {
      console.log('Auth error:', authError) // 添加日志
      return NextResponse.json({ error: '无效的认证token', details: authError.message }, { status: 401 })
    }
    
    if (!user) {
      console.log('No user found') // 添加日志
      return NextResponse.json({ error: '无效的认证token' }, { status: 401 })
    }

    console.log('User authenticated:', user.id) // 添加日志
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const { data, error } = await supabase
      .from('static_pages')
      .select('*')
      .eq('owner', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) {
      console.log('Database error:', error) // 添加日志
      throw error
    }

    console.log('Successfully retrieved pages:', data) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in GET /api/external/pages:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 创建新页面
export async function POST(request: Request) {
  try {
    console.log('Received POST request') // 添加日志
    const accessToken = getAccessToken(request)
    if (!accessToken) {
      console.log('No access token provided') // 添加日志
      return NextResponse.json({ error: '未提供认证token' }, { status: 401 })
    }

    console.log('Creating Supabase client') // 添加日志
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return null
          },
          set(name: string, value: string, options: any) {
            // 不需要设置 cookie
          },
          remove(name: string, options: any) {
            // 不需要删除 cookie
          },
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    )

    console.log('Getting user with token') // 添加日志
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (authError) {
      console.log('Auth error:', authError) // 添加日志
      return NextResponse.json({ error: '无效的认证token', details: authError.message }, { status: 401 })
    }
    
    if (!user) {
      console.log('No user found') // 添加日志
      return NextResponse.json({ error: '无效的认证token' }, { status: 401 })
    }

    console.log('User authenticated:', user.id) // 添加日志
    const { title, content } = await request.json()
    if (!title?.trim() || !content?.trim()) {
      console.log('Missing title or content') // 添加日志
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('static_pages')
      .insert({
        title,
        content,
        owner: user.id
      })
      .select()
      .single()

    if (error) {
      console.log('Database error:', error) // 添加日志
      throw error
    }

    console.log('Successfully created page:', data) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in POST /api/external/pages:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}