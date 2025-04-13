"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FunctionCardData {
  name: string
  url: string
  sort_order: number
  is_public: boolean
  description?: string
}

interface FunctionFormProps {
  initialData?: FunctionCardData
  onSubmit: (data: FunctionCardData) => Promise<{ error?: string }>
}

export function FunctionForm({ initialData, onSubmit }: FunctionFormProps) {
  const [formData, setFormData] = useState<FunctionCardData>(
    initialData || {
      name: "",
      url: "",
      sort_order: 0,
      is_public: false,
      description: "",
    }
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSwitchChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      is_public: checked,
    }))
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await onSubmit(formData)
      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">功能名称 *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="输入功能名称"
            className="h-10" // 增加输入框高度
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description || ""}
            onChange={handleChange}
            placeholder="输入功能描述"
            className="min-h-[100px]" // 增加文本区域高度
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">跳转链接 *</Label>
          <Input
            id="url"
            name="url"
            value={formData.url}
            onChange={handleChange}
            placeholder="输入链接地址"
            className="h-10" // 增加输入框高度
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort_order">排序</Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            value={formData.sort_order}
            onChange={handleNumberChange}
            className="h-10" // 增加输入框高度
            min={0}
          />
          <p className="text-sm text-muted-foreground">数字越小排序越靠前</p>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="is_public"
            checked={formData.is_public}
            onCheckedChange={handleSwitchChange}
          />
          <Label htmlFor="is_public">公开可见</Label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting} className="h-10"> {/* 增加按钮高度 */}
          {isSubmitting ? "保存中..." : "保存"}
        </Button>
      </div>
    </form>
  )
}