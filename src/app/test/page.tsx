"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Header from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createBrowserClient } from '@supabase/ssr'

export default function TestPage() {
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [pageId, setPageId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 获取当前用户的access token
  const handleGetAccessToken = async () => {
    try {
      setLoading(true)
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        throw new Error(error.message)
      }

      if (!session) {
        throw new Error('未登录')
      }

      const token = session.access_token
      setAccessToken(token)
      setResult({ session })
      toast.success('获取成功')
    } catch (err) {
      toast.error('获取失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 复制access token到剪贴板
  const handleCopyToken = () => {
    if (accessToken) {
      navigator.clipboard.writeText(accessToken)
      toast.success('已复制到剪贴板')
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
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除失败')
      }
      
      const data = await response.json()
      setResult(data)
      toast.success('删除成功')
    } catch (err) {
      toast.error('删除失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 获取静态页面列表
  const handleGetPages = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pages')
      
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

  // 获取外部API页面列表
  const handleGetExternalPages = async () => {
    if (!accessToken) {
      toast.error('请先获取Access Token')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/external/pages', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
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

  // 创建新的静态页面
  const handleCreatePage = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '测试页面',
          content: '<h1>测试内容</h1>',
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '创建失败')
      }
      
      const data = await response.json()
      setResult(data)
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
      const response = await fetch(`/api/pages/${pageId}`)
      
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

  // 生成页面截图
  const handleGenerateScreenshot = async () => {
    if (!pageId) {
      toast.error('请输入页面ID')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/pages/${pageId}/screenshot`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '生成失败')
      }
      
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
      
      toast.success('截图已下载')
    } catch (err) {
      toast.error('生成失败', {
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
                测试静态页面相关的API功能。
              </p>
            </div>

            <div className="mb-6">
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

            <div className="mb-6">
              <Label htmlFor="accessToken">Access Token</Label>
              <div className="flex gap-4">
                <Input
                  id="accessToken"
                  value={accessToken}
                  readOnly
                  placeholder="获取access token后显示"
                  className="max-w-lg font-mono text-sm"
                />
                <Button
                  onClick={handleCopyToken}
                  disabled={!accessToken}
                  variant="outline"
                >
                  复制
                </Button>
                <Button
                  onClick={handleGetAccessToken}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      获取中
                    </>
                  ) : (
                    '获取Token'
                  )}
                </Button>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>API测试</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    onClick={handleGetExternalPages}
                    disabled={loading || !accessToken}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加载中
                      </>
                    ) : (
                      '获取外部API页面列表'
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleCreatePage}
                    disabled={loading}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        处理中
                      </>
                    ) : (
                      '创建新页面'
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

                  <Button
                    onClick={handleGenerateScreenshot}
                    disabled={loading || !pageId}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        生成中
                      </>
                    ) : (
                      '生成页面截图'
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