"use client"

import { useEffect, useState } from 'react'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface StaticPage {
  id: number
  title: string
  content: string
  created_at: string
}

export default function PreviewPage() {
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pageId, setPageId] = useState('')
  const [pageData, setPageData] = useState<StaticPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        setUserEmail(data.user?.email)
        setIsAdmin(!!data.user?.isAdmin)
      } catch (error) {
        console.error('Failed to fetch user session:', error)
      }
    }

    initializeUser()
  }, [])
  const fetchPageData = async () => {
    if (!pageId) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/pages/${pageId}`)
      if (!response.ok) throw new Error('获取页面数据失败')
      
      const data = await response.json()
      setPageData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleScreenshot = async () => {
    if (!pageId) return
    
    try {
      const response = await fetch(`/api/pages/${pageId}/screenshot`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('生成截图失败')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      
      // 创建一个临时链接来下载截图
      const a = document.createElement('a')
      a.href = url
      a.download = `page-${pageId}-screenshot.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成截图失败')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header email={userEmail} isAdmin={isAdmin} />
      
      <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">页面预览</h1>
          <p className="text-muted-foreground mt-2">
            预览静态页面并生成截图
          </p>
        </div>
        
        <div className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="pageId">页面ID</Label>
              <Input
                id="pageId"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="输入页面ID"
              />
            </div>
            <Button onClick={fetchPageData} disabled={!pageId || loading}>
              {loading ? '加载中...' : '加载页面'}
            </Button>
            <Button
              onClick={handleScreenshot}
              disabled={!pageData}
              variant="outline"
            >
              生成截图
            </Button>
          </div>

          {error && (
            <div className="p-4 text-red-500 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {pageData && (
            <div className="border rounded-lg overflow-hidden">
              <div className="p-4 bg-muted border-b">
                <h2 className="font-semibold">{pageData.title}</h2>
                <p className="text-sm text-muted-foreground">
                  创建时间: {new Date(pageData.created_at).toLocaleString()}
                </p>
              </div>
              <iframe
                srcDoc={pageData.content}
                className="w-full h-[600px] border-0"
                title={pageData.title}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}