"use client"

import { useState } from 'react'
import { Note } from '../page'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Calendar, Clock } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface NoteItemProps {
  note: Note
  onEdit: () => void
  onDelete: () => Promise<void>
  viewType: 'grid' | 'list'
}

export default function NoteItem({ note, onEdit, onDelete, viewType }: NoteItemProps) {
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

  // 格式化创建日期
  const createdDate = new Date(note.created_at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  // 格式化更新日期
  const updatedDate = new Date(note.updated_at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <>
      <Card className={cn(
        "group transition-all duration-200",
        viewType === 'grid' ? "hover:shadow-md" : ""
      )}>
        <CardContent className="pt-6">
          <div className="whitespace-pre-wrap break-words">
            {note.content}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4 sm:gap-0 sm:justify-between border-t pt-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>创建于 {createdDate}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>创建时间</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {note.updated_at !== note.created_at && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>更新于 {updatedDate}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>最后更新时间</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit className="h-4 w-4 mr-1" />
              编辑
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setShowDeleteAlert(true)}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
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
          {/* 修改删除按钮样式 */}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
