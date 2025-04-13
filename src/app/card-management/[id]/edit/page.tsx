"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FunctionForm } from '../../components/function-form'
import { toast } from "sonner"

// 定义类型
interface FunctionCardData {
  name: string;
  url: string;
  sort_order: number;
  is_public: boolean;
  description?: string;
}

export default function EditPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [functionData, setFunctionData] = useState<FunctionCardData | null>(null)

  // 加载数据
  useEffect(() => {
    const loadFunction = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/functions/${params.id}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '加载失败')
        }
        
        const data = await response.json()
        setFunctionData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知错误')
        console.error('加载失败:', err)
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      loadFunction()
    }
  }, [params.id])

  // 更新函数
  const updateFunction = async (formData: FunctionCardData) => {
    try {
      const response = await fetch(`/api/functions/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        return { error: errorData.error || '更新失败' }
      }
      
      toast.success('更新成功', {
        description: '功能卡片已成功更新',
      })
      
      router.push('/card-management')
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  if (loading) {
    return <div className="p-8 text-center">加载中...</div>
  }

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="text-center text-red-500">
          加载失败: {error}
          <div className="mt-4">
            <button onClick={() => router.push('/card-management')}>
              返回列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-8">编辑功能卡片</h2>
      {functionData && (
        <FunctionForm 
          initialData={functionData} 
          onSubmit={updateFunction} 
        />
      )}
    </div>
  )
}