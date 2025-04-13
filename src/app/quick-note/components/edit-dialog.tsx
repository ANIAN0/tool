"use client"

import { useState, useEffect, KeyboardEvent } from 'react'
import { Note } from '../page'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface EditDialogProps {
  note: Note
  isOpen: boolean
  onClose: () => void
  onSave: (content: string) => Promise<void>
}

export default function EditDialog({ note, isOpen, onClose, onSave }: EditDialogProps) {
  const [content, setContent] = useState(note.content)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setContent(note.content)
  }, [note])

  const handleSave = async () => {
    if (!content.trim() || isSaving) return
    
    try {
      setIsSaving(true)
      await onSave(content)
    } catch (error) {
      console.error('保存失败:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑记录</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[200px]"
            placeholder="输入内容..."
            autoFocus
          />
          <p className="text-sm text-muted-foreground mt-2">
            按Ctrl+Enter快速保存
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!content.trim() || isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
