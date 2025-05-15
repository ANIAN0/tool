import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

// 生成页面截图
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    // 获取页面数据
    const { data: pageData, error: pageError } = await supabase
      .from('static_pages')
      .select('*')
      .eq('id', id)
      .eq('owner', user.id)
      .single()

    if (pageError || !pageData) {
      return NextResponse.json({ error: '页面不存在' }, { status: 404 })
    }

    // 启动浏览器
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    })

    try {
      const page = await browser.newPage()
      
      // 设置视口大小
      await page.setViewport({
        width: 1920,
        height: 1080
      })

      // 设置页面内容
      await page.setContent(pageData.content, {
        waitUntil: 'networkidle0'
      })

      // 生成截图
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true
      })

      await browser.close()

      // 返回截图数据
      return new NextResponse(screenshot, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename=page-${id}-screenshot.png`
        }
      })
    } catch (error) {
      await browser.close()
      throw error
    }
  } catch (error: unknown) {
    console.error('生成页面截图失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}