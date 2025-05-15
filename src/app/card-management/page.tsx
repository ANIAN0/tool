"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable } from './components/data-table/data-table'
import { columns, Function } from './components/data-table/columns'
import { useRouter } from 'next/navigation'
import { toast } from "sonner"
import Header from '@/components/header'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { FunctionForm } from './components/function-form'
import { Plus, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CardManagementPage() {
  const [functions, setFunctions] = useState<Function[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const router = useRouter()

  // 加载数据
  const loadFunctions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/functions')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '加载失败')
      }
      
      const data = await response.json()
      setFunctions(data)
      
      // 获取当前用户信息
      const userResponse = await fetch('/api/user')
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setUserId(userData.id)
        setIsAdmin(userData.is_admin || false)
        setUserEmail(userData.email)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
      toast.error('加载失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 处理删除
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/functions/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除失败')
      }
      
      toast.success('删除成功', {
        description: '功能卡片已成功删除',
      })
      
      loadFunctions()
    } catch (err) {
      toast.error('删除失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  // 创建新功能 - 添加类型定义
  const handleCreate = async (formData: Partial<Function>) => {
    try {
      const response = await fetch('/api/functions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        return { error: errorData.error || '创建失败' }
      }
      
      toast.success('创建成功', {
        description: '功能卡片已成功创建',
      })
      
      setIsSheetOpen(false)
      loadFunctions()
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  useEffect(() => {
    loadFunctions()
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header email={userEmail || undefined} isAdmin={isAdmin} />
        <div className="flex-1 p-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive">加载失败</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">{error}</p>
              <div className="flex gap-4">
                <Button onClick={() => router.push('/protected')}>返回首页</Button>
                <Button variant="outline" onClick={() => loadFunctions()}>重试</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header email={userEmail || undefined} isAdmin={isAdmin} />
      
      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="py-4 md:py-8 space-y-4">
            <div className="flex justify-between items-center gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">功能管理</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  管理和维护功能卡片，你可以创建、编辑或删除功能卡片。
                </p>
              </div>
              
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="flex items-center gap-2" size="sm">
                    <Plus className="h-4 w-4" />
                    <span>新增功能</span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-[450px]">
                  <SheetHeader className="pb-4 border-b px-5">
                    <SheetTitle className="text-xl">新增功能</SheetTitle>
                    <SheetDescription className="text-muted-foreground">
                      创建新的功能卡片，填写完成后点击保存。
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6 px-5 overflow-y-auto max-h-[calc(100vh-200px)]">
                    <FunctionForm onSubmit={handleCreate} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            
            <DataTable
              columns={columns}
              data={functions}
              currentUserId={userId || ''}
              onDelete={handleDelete}
              refreshData={loadFunctions}
              isLoading={loading}
            />
          </div>
        </div>
      </main>
    </div>
  )
}