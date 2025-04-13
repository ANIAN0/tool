"use client"

import { useRouter } from 'next/navigation'
import { FunctionForm } from '../components/function-form'
import { toast } from "sonner" // 替换为sonner的toast

// 定义类型
interface FunctionCardData {
  name: string;
  url: string;
  sort_order: number;
  is_public: boolean;
  description?: string;
}

export default function NewFunctionPage() {
  const router = useRouter()
  // 移除useToast钩子

  // 创建函数
  const createFunction = async (formData: FunctionCardData) => {
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
      
      // 使用sonner的toast
      toast.success('创建成功', {
        description: '功能卡片已成功创建',
      })
      
      router.push('/card-management')
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-8">创建新功能卡片</h2>
      <FunctionForm onSubmit={createFunction} />
    </div>
  )
}