'use client'

import { useState } from 'react'
import { Note } from '../page'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface NoteItemProps {
  note: Note
  onEdit: () => void
  onDelete: () => Promise<void>
}

export default function NoteItem({ note, onEdit, onDelete }: NoteItemProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  
  const handleDelete = async () => {
    if (isDeleting) return
    
    try {
      setIsDeleting(true)
      await onDelete()
    } catch (error) {
      console.error('删除失败:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteAlert(false)
    }
  }

  // 格式化日期
  const formattedDate = new Date(note.updated_at || note.created_at)
    .toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="whitespace-pre-wrap break-words">
            {note.content}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <span className="text-sm text-muted-foreground">
            {formattedDate}
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onEdit}
            >
              <Edit className="h-4 w-4 mr-1" />
              编辑
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setShowDeleteAlert(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {isDeleting ? '删除中...' : '删除'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，确定要删除这条记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}