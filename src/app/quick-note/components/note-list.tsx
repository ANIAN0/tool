'use client'

import { Note } from '../page'
import NoteItem from './note-item'
import { RefreshCw, FileText } from 'lucide-react'
import './animations.css'

interface NoteListProps {
  notes: Note[]
  loading: boolean
  onEdit: (note: Note) => void
  onDelete: (id: string) => Promise<void>
  viewType: 'grid' | 'list'
}

export default function NoteList({ 
  notes, 
  loading, 
  onEdit, 
  onDelete,
  viewType 
}: NoteListProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-16 text-center bg-muted/20 rounded-lg border border-dashed animate-fade-in"
      >
        <FileText className="h-16 w-16 mb-4 text-muted-foreground/30" />
        <h3 className="text-xl font-medium mb-2">暂无记录</h3>
        <p className="text-muted-foreground max-w-md">
          在左侧输入框中添加您的第一条记录
        </p>
      </div>
    )
  }

  return (
    <div className={
      viewType === 'grid' 
        ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
        : "space-y-4"
    }>
      {notes.map((note, index) => (
        <div
          key={note.id}
          className="animate-fade-in"
          style={{
            animationDelay: `${index * 50}ms`
          }}
        >
          <NoteItem 
            note={note} 
            onEdit={() => onEdit(note)} 
            onDelete={() => onDelete(note.id)}
            viewType={viewType}
          />
        </div>
      ))}
    </div>
  )
}