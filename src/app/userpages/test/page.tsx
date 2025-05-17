"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Header from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function TestPage() {
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [pageId, setPageId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  // 获取公共页面列表
  const handleGetPages = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/external/pages/public')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取失败')
      }
      
      const data = await response.json()
      setResult(data)
      toast.success('获取成功')
    } catch (err) {
      toast.error('获取失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 创建新的公共页面
  const handleCreatePage = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('请填写标题和内容')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/external/pages/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '创建失败')
      }
      
      const data = await response.json()
      setResult(data)
      setTitle('')
      setContent('')
      toast.success('创建成功')
    } catch (err) {
      toast.error('创建失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 获取单个页面
  const handleGetPage = async () => {
    if (!pageId) {
      toast.error('请输入页面ID')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/external/pages/public/${pageId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取失败')
      }
      
      const data = await response.json()
      setResult(data)
      toast.success('获取成功')
    } catch (err) {
      toast.error('获取失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 删除页面
  const handleDeletePage = async () => {
    if (!pageId) {
      toast.error('请输入页面ID')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/external/pages/public', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: pageId }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除失败')
      }
      
      const data = await response.json()
      setResult(data)
      setPageId('')
      toast.success('删除成功')
    } catch (err) {
      toast.error('删除失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 获取页面截图
  const handleScreenshot = async () => {
    if (!pageId) {
      toast.error('请输入页面ID')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/external/pages/public/${pageId}/screenshot`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取截图失败')
      }
      
      // 创建Blob对象
      const blob = await response.blob()
      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `page-${pageId}.jpg`
      document.body.appendChild(a)
      a.click()
      // 清理
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('截图已下载')
    } catch (err) {
      toast.error('获取截图失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header email={userEmail || undefined} isAdmin={isAdmin} />
      
      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="py-4 md:py-8 space-y-4">
            <div>
              <h1 className="text-2xl font-bold">测试页面</h1>
              <p className="text-sm text-muted-foreground mt-1">
                测试公共页面相关的API功能。
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>创建新页面</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">标题</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入页面标题"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">内容</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="输入页面内容（支持HTML）"
                    rows={6}
                  />
                </div>
                <Button
                  onClick={handleCreatePage}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建中
                    </>
                  ) : (
                    '创建页面'
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>查询和删除页面</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pageId">页面ID</Label>
                  <div className="flex gap-4">
                    <Input
                      id="pageId"
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                      placeholder="输入页面ID"
                      className="max-w-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button
                    onClick={handleGetPages}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加载中
                      </>
                    ) : (
                      '获取页面列表'
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleGetPage}
                    disabled={loading || !pageId}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加载中
                      </>
                    ) : (
                      '获取单个页面'
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleScreenshot}
                    disabled={loading || !pageId}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        获取截图中
                      </>
                    ) : (
                      '获取页面截图'
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleDeletePage}
                    disabled={loading || !pageId}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        删除中
                      </>
                    ) : (
                      '删除页面'
                    )}
                  </Button>
                </div>
                
                {result && (
                  <Card>
                    <CardHeader>
                      <CardTitle>返回结果</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}