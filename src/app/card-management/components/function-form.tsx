'use client'

import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'

const formSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  url: z.string()
    .refine(value => {
      // 支持完整URL或以/开头的相对路径
      return value.startsWith('http://') || 
             value.startsWith('https://') || 
             value.startsWith('/')
    }, '请输入有效的URL或以/开头的相对路径'),
  sort_order: z.coerce.number().min(0),
  is_public: z.boolean().default(true),
})

export function FunctionForm({ 
  initialData,
  onSubmit  // 接收的prop
}: {
  initialData?: any
  onSubmit: (data: any) => Promise<any>
}) {
  const router = useRouter()
  const supabase = createClient()
  // 添加提交状态
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 修改defaultValues处理
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      ...initialData,
      // 确保sort_order是有效数字，如果转换失败则默认为0
      sort_order: isNaN(Number(initialData.sort_order)) ? 0 : Number(initialData.sort_order)
    } : {
      name: '',
      description: '',
      url: '',
      sort_order: 0,
      is_public: true,
    }
  })

  // 将本地提交函数重命名
  const handleFormSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) return // 防止重复提交
    
    try {
      setIsSubmitting(true) // 开始提交，设置状态
      
      // 直接调用服务端action
      const result = await onSubmit(values)
      
      // 检查是否有错误
      if (result?.error) {
        throw new Error(result.error)
      }
      
      // 成功后自动跳转（服务端action中已经包含了redirect）
    } catch (error) {
      console.error('提交失败:', error)
      // 可以添加错误提示UI
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* 名称字段 */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>功能名称</FormLabel>
                <FormControl>
                  <Input placeholder="请输入功能名称" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* 排序字段 - 修改onChange处理 */}
          <FormField
            control={form.control}
            name="sort_order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>排序序号</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0"
                    {...field} 
                    // 确保输入值为有效数字
                    onChange={e => {
                      const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                      field.onChange(isNaN(value) ? 0 : value);
                    }}
                    // 确保值始终为字符串
                    value={field.value.toString()}
                  />
                </FormControl>
                <FormDescription>数字越小排列越靠前</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 描述字段 */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>功能描述</FormLabel>
              <FormControl>
                <Input placeholder="请输入功能描述（可选）" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* URL字段 */}
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>跳转链接</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/feature" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 公开状态 */}
        <FormField
          control={form.control}
          name="is_public"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>公开可见</FormLabel>
                <FormDescription>
                  开启后所有用户可见，关闭则仅自己可见
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* 操作按钮 */}
        <div className="flex gap-4 justify-end">
          <Button 
            type="submit" 
            size="lg" 
            disabled={isSubmitting}
          >
            {isSubmitting ? '保存中...' : '保存更改'}
          </Button>
          <Button 
            variant="outline" 
            type="button"
            disabled={isSubmitting}
            onClick={() => router.push('/card-management')}
          >
            取消
          </Button>
        </div>
      </form>
    </Form>
  )
}