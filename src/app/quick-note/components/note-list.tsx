'use client'

import { Note } from '../page'
import NoteItem from './note-item'

interface NoteListProps {
  notes: Note[]
  loading: boolean
  onEdit: (note: Note) => void
  onDelete: (id: string) => Promise<void>
}

export default function NoteList({ notes, loading, onEdit, onDelete }: NoteListProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex justify-center items-center h-40 border rounded-lg">
        <p className="text-muted-foreground">暂无记录，开始添加吧！</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <NoteItem 
          key={note.id} 
          note={note} 
          onEdit={() => onEdit(note)} 
          onDelete={() => onDelete(note.id)} 
        />
      ))}
    </div>
  )
}