"use client"

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { use } from 'react'

interface StaticPage {
  id: number
  title: string
  content: string
  created_at: string
}

export default function PageView({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [pageData, setPageData] = useState<StaticPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const response = await fetch(`/api/pages/${resolvedParams.id}`)
        if (!response.ok) throw new Error('获取页面数据失败')
        
        const data = await response.json()
        setPageData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取数据失败')
      } finally {
        setLoading(false)
      }
    }

    fetchPageData()
  }, [resolvedParams.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-4 text-red-500 bg-red-50 rounded-md">
          {error || '页面不存在'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 bg-muted border-b">
        <h1 className="text-2xl font-semibold">{pageData.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          创建时间: {new Date(pageData.created_at).toLocaleString()}
        </p>
      </div>
      <div
        className="p-4"
        dangerouslySetInnerHTML={{ __html: pageData.content }}
      />
    </div>
  )
}