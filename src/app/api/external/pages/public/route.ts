import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// 获取公共页面列表
export async function GET(request: Request) {
  try {
    console.log('Received GET request for public pages') // 添加日志

    // 创建Supabase客户端，无需认证
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
        }
      }
    )

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 查询已发布的公共页面
    const { data, error } = await supabase
      .from('static_pages')
      .select('*')
      .eq('is_published', true) // 只查询已发布的页面
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) {
      console.log('Database error:', error) // 添加日志
      throw error
    }

    console.log('Successfully retrieved public pages:', data.length) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in GET /api/external/pages/public:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 新增公共页面
export async function POST(request: Request) {
  try {
    console.log('Received POST request for public page') // 添加日志

    // 创建Supabase客户端，无需认证
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
        }
      }
    )

    const { title, content } = await request.json()
    if (!title?.trim() || !content?.trim()) {
      console.log('Missing title or content') // 添加日志
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 })
    }

    // 插入新页面，默认设置为已发布
    const { data, error } = await supabase
      .from('static_pages')
      .insert({
        title,
        content,
        is_published: true,
        published_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.log('Database error:', error) // 添加日志
      throw error
    }

    console.log('Successfully created public page:', data) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in POST /api/external/pages/public:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 更新公共页面
export async function PUT(request: Request) {
  try {
    console.log('Received PUT request for public page') // 添加日志

    // 创建Supabase客户端，无需认证
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
        }
      }
    )

    const { id, title, content } = await request.json()
    if (!id || !title?.trim() || !content?.trim()) {
      console.log('Missing id, title or content') // 添加日志
      return NextResponse.json({ error: 'ID、标题和内容不能为空' }, { status: 400 })
    }

    // 更新页面内容
    const { data, error } = await supabase
      .from('static_pages')
      .update({
        title,
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.log('Database error:', error) // 添加日志
      throw error
    }

    console.log('Successfully updated public page:', data) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in PUT /api/external/pages/public:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}

// 删除公共页面
export async function DELETE(request: Request) {
  try {
    console.log('Received DELETE request for public page') // 添加日志

    // 创建Supabase客户端，无需认证
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
        }
      }
    )

    const { id } = await request.json()
    if (!id) {
      console.log('Missing id') // 添加日志
      return NextResponse.json({ error: 'ID不能为空' }, { status: 400 })
    }

    // 删除页面
    const { error } = await supabase
      .from('static_pages')
      .delete()
      .eq('id', id)

    if (error) {
      console.log('Database error:', error) // 添加日志
      throw error
    }

    console.log('Successfully deleted public page:', id) // 添加日志
    return NextResponse.json({ message: '页面已删除' })
  } catch (error: unknown) {
    console.error('Error in DELETE /api/external/pages/public:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}