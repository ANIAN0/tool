import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// 获取单个公共页面
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await context.params
    console.log('Received GET request for public page:', resolvedParams.id) // 添加日志

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

    const { id } = resolvedParams
    
    // 查询数据库，只获取已发布的页面
    const { data, error: dbError } = await supabase
      .from('static_pages')
      .select('*')
      .eq('id', id)
      .eq('is_published', true) // 只查询已发布的页面
      .single()
    
    if (dbError) {
      console.log('Database error:', dbError) // 添加日志
      return NextResponse.json({ error: '未找到页面或页面未公开' }, { status: 404 })
    }
    
    console.log('Successfully retrieved public page:', data) // 添加日志
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in GET /api/external/pages/public/[id]:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}