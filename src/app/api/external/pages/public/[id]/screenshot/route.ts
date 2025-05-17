import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// 获取页面截图
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await context.params
    console.log('Received GET request for page screenshot:', resolvedParams.id) // 添加日志

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
    const { data: pageData, error: dbError } = await supabase
      .from('static_pages')
      .select('*')
      .eq('id', id)
      .eq('is_published', true) // 只查询已发布的页面
      .single()
    
    if (dbError) {
      console.log('Database error:', dbError) // 添加日志
      return NextResponse.json({ error: '未找到页面或页面未公开' }, { status: 404 })
    }

    // 检查环境变量
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      console.error('Missing NEXT_PUBLIC_APP_URL environment variable')
      return NextResponse.json({ error: '服务器配置错误：缺少应用URL配置' }, { status: 500 })
    }

    // 构建页面URL
    const pageUrl = `${appUrl}/pages/${id}`
    console.log('Capturing screenshot for URL:', pageUrl)

    // 检查API密钥
    const apiKey = process.env.BROWSERLESS_API_KEY
    if (!apiKey) {
      console.error('Missing BROWSERLESS_API_KEY environment variable')
      return NextResponse.json({ error: '服务器配置错误：缺少截图服务API密钥' }, { status: 500 })
    }

    // 调用browserless.io的截图API
    const response = await fetch(`https://production-sfo.browserless.io/screenshot?token=${apiKey}`, {
      method: 'POST',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: pageUrl,
        options: {
          fullPage: true,
          type: 'png'
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '未知错误')
      console.error('Screenshot API error:', response.status, response.statusText, errorText) // 添加详细错误日志
      return NextResponse.json(
        { error: `截图服务出错：${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    // 获取截图数据
    const buffer = Buffer.from(await response.arrayBuffer())
    
    // 返回截图
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="page-${id}.png"`
      }
    })
  } catch (error: unknown) {
    console.error('Error in GET /api/external/pages/public/[id]/screenshot:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}