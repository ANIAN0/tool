"use client"

import { useEffect, useState } from 'react'
import '@n8n/chat/style.css'
import { createChat } from '@n8n/chat'
import Header from '@/components/header'

export default function ChatPage() {
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    createChat({
      webhookUrl: 'http://124.156.205.61:5678/webhook/1c18efbe-6c40-446e-b6b7-64735abc63ec/chat'  // 请替换为你的实际webhook URL
    })
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header email={userEmail} isAdmin={isAdmin} />
      
      <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">AI 助手</h1>
          <p className="text-muted-foreground mt-2">
            使用 AI 助手来帮助你解决问题
          </p>
        </div>
        
        <div className="h-[600px] border rounded-lg overflow-hidden">
          {/* Chat 组件会通过 createChat 自动注入到页面中 */}
        </div>
      </main>
    </div>
  )
}