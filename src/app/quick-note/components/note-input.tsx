'use client'

import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter } from '@/components/ui/card'

interface NoteInputProps {
  onSubmit: (content: string) => Promise<void>
}

export default function NoteInput({ onSubmit }: NoteInputProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return
    
    try {
      setIsSubmitting(true)
      await onSubmit(content)
      setContent('') // 清空输入框
    } catch (error) {
      console.error('提交失败:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 按下Enter键提交，Shift+Enter换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <Textarea
          placeholder="输入你的想法..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[150px] resize-none"
        />
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          按Enter键提交，Shift+Enter换行
        </p>
        <Button 
          onClick={handleSubmit} 
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? '提交中...' : '提交'}
        </Button>
      </CardFooter>
    </Card>
  )
}