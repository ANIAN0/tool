"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import Header from "@/components/header"
import { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface DebugLayoutProps {
  user: User | null
  loading: boolean
  sections: {
    id: string
    title: string
    icon: React.ReactNode
    content: React.ReactNode
  }[]
}

export default function DebugLayout({ user, loading, sections }: DebugLayoutProps) {
  const router = useRouter()
  const supabase = createClient()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-lg">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 更新 Header，传入用户信息和管理员状态 */}
      <Header 
        email={user?.email} 
        isAdmin={user?.email?.includes('admin') || false} 
      />
      
      <main className="flex-1 py-8">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">开发规范与示例</h1>
            {/* 移除重复的用户登录信息显示部分 */}
          </div>
          
          <Alert className="mb-8">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>开发指南</AlertTitle>
            <AlertDescription>
              本页面展示了项目中常用的实现方式和规范，可作为开发参考。每个示例都包含了代码说明和实现方法。
            </AlertDescription>
          </Alert>
          
          <Tabs defaultValue={sections[0].id} className="mb-8">
            <TabsList className="grid grid-cols-5 mb-4">
              {sections.map((section) => (
                <TabsTrigger 
                  key={section.id} 
                  value={section.id} 
                  className="flex items-center gap-2"
                >
                  {section.icon}
                  <span>{section.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {sections.map((section) => (
              <TabsContent key={section.id} value={section.id}>
                {section.content}
              </TabsContent>
            ))}
          </Tabs>
          
          <Separator className="my-8" />
          
          <div className="bg-muted/20 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">后续扩展计划</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>表单验证示例</li>
              <li>数据获取与缓存策略</li>
              <li>状态管理最佳实践</li>
              <li>响应式设计示例</li>
              <li>动画效果实现</li>
              <li>主题切换功能</li>
              <li>国际化实现方案</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}