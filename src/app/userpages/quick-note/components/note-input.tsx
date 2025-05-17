"use client"

import { useState, KeyboardEvent, useEffect, useRef } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'

interface NoteInputProps {
  onSubmit: (content: string) => Promise<void>
}

export default function NoteInput({ onSubmit }: NoteInputProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动聚焦输入框
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return
    
    try {
      setIsSubmitting(true)
      await onSubmit(content)
      setContent('') // 清空输入框
      
      // 提交后重新聚焦输入框
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 0)
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
    <Card className="w-full shadow-sm hover:shadow transition-shadow duration-200">
      <CardContent className="pt-6">
        <Textarea
          ref={textareaRef}
          placeholder="输入你的想法..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[150px] resize-none focus:ring-1 focus:ring-primary"
        />
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-3">
        <p className="text-sm text-muted-foreground">
          按Enter键提交，Shift+Enter换行
        </p>
        <Button 
          onClick={handleSubmit} 
          disabled={!content.trim() || isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              提交
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
