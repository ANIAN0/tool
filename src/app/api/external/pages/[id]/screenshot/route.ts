import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

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
export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    console.log('Received POST request for screenshot of page:', context.params.id) // 添加日志
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
    
    // 启动浏览器
    console.log('Launching browser') // 添加日志
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    })
    
    try {
      console.log('Creating new page') // 添加日志
      const page = await browser.newPage()
      
      // 设置视口大小
      console.log('Setting viewport') // 添加日志
      await page.setViewport({
        width: 1920,
        height: 1080
      })
      
      // 设置页面内容
      console.log('Setting page content') // 添加日志
      await page.setContent(pageData.content, {
        waitUntil: 'networkidle0'
      })
      
      // 生成截图
      console.log('Generating screenshot') // 添加日志
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true
      })
      
      console.log('Closing browser') // 添加日志
      await browser.close()
      
      // 返回截图数据
      console.log('Returning screenshot') // 添加日志
      const response = new NextResponse(screenshot, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename=page-${id}-screenshot.png`
        }
      })
      
      return response
    } catch (error) {
      console.log('Error during screenshot generation:', error) // 添加日志
      await browser.close()
      throw error
    }
  } catch (error: unknown) {
    console.error('Error in POST /api/external/pages/[id]/screenshot:', error) // 添加日志
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}