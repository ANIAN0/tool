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

// 生成页面截图
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await context.params
    console.log('Received POST request for screenshot of page:', resolvedParams.id) // 添加日志
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
    const { id } = resolvedParams
    
    // 获取页面数据
    console.log('Fetching page data') // 添加日志
    const { data: pageData, error: pageError } = await supabase
      .from('static_pages')
      .select('*')
      .eq('id', id)
      .eq('owner', user.id)
      .single()
    
    if (pageError || !pageData) {
      console.log('Page not found or access denied:', pageError) // 添加日志
      return NextResponse.json({ error: '页面不存在或无权访问' }, { status: 404 })
    }
    
    // 使用 Browserless.io API 生成截图
    console.log('Calling Browserless API') // 添加日志
    const response = await fetch('https://chrome.browserless.io/content', {
      method: 'POST',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.BROWSERLESS_API_KEY}`
      },
      body: JSON.stringify({
        html: pageData.content,
        options: {
          viewport: {
            width: 1920,
            height: 1080
          },
          waitFor: 1000,
          screenshot: {
            type: 'png',
            fullPage: true,
            omitBackground: true
          }
        }
      })
    })

    if (!response.ok) {
      console.log('Browserless API error:', response.statusText) // 添加日志
      throw new Error('截图生成失败')
    }

    const screenshot = await response.arrayBuffer()
    
    // 返回截图数据
    console.log('Returning screenshot') // 添加日志
    return new NextResponse(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename=page-${id}-screenshot.png`
      }
    })
  } catch (error: unknown) {
    console.error('Error in POST /api/external/pages/[id]/screenshot:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}