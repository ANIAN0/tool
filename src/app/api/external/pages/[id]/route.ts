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

// 获取单个页面
export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    console.log('Received GET request for page:', context.params.id) // 添加日志
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
    const { id } = context.params
    
    // 查询数据库
    const { data, error: dbError } = await supabase
      .from('static_pages')
      .select('*')
      .eq('id', id)
      .eq('owner', user.id)
      .single()
    
    if (dbError) {
      console.log('Database error:', dbError) // 添加日志
      return NextResponse.json({ error: '未找到页面' }, { status: 404 })
    }
    
    console.log('Successfully retrieved page:', data) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in GET /api/external/pages/[id]:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 更新页面
export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    console.log('Received PATCH request for page:', context.params.id) // 添加日志
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
    const { id } = context.params
    
    // 解析请求体
    const { title, content } = await request.json()
    
    // 验证必填字段
    if (!title?.trim() || !content?.trim()) {
      console.log('Missing title or content') // 添加日志
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 })
    }
    
    // 更新数据库
    const { data, error: dbError } = await supabase
      .from('static_pages')
      .update({ title, content })
      .eq('id', id)
      .eq('owner', user.id)
      .select()
      .single()
    
    if (dbError) {
      console.log('Database error:', dbError) // 添加日志
      return NextResponse.json({ error: '未找到页面或无权更新' }, { status: 404 })
    }
    
    console.log('Successfully updated page:', data) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in PATCH /api/external/pages/[id]:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 删除页面
export async function DELETE(request: Request, context: { params: { id: string } }) {
  try {
    console.log('Received DELETE request for page:', context.params.id) // 添加日志
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
    const { id } = context.params
    
    // 删除数据库记录
    const { error: dbError } = await supabase
      .from('static_pages')
      .delete()
      .eq('id', id)
      .eq('owner', user.id)
    
    if (dbError) {
      console.log('Database error:', dbError) // 添加日志
      return NextResponse.json({ error: '未找到页面或无权删除' }, { status: 404 })
    }
    
    console.log('Successfully deleted page:', id) // 添加日志
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in DELETE /api/external/pages/[id]:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}