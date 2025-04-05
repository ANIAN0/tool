'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NoteInput from './components/note-input'
import NoteList from './components/note-list'
import EditDialog from './components/edit-dialog'
import { redirect } from 'next/navigation'
import { RealtimeChannel } from '@supabase/realtime-js'

// 笔记类型定义
export type Note = {
  id: string
  content: string
  created_at: string
  updated_at: string
  expires_at: string | null
  owner: string
}

export default function QuickNotePage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const supabase = createClient()

  // 加载笔记
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        redirect('/login')
        return
      }

      // 加载初始数据
      const { data, error } = await supabase
        .from('temporary_contents')
        .select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('加载笔记失败:', error)
        return
      }

      setNotes(data || [])
      setLoading(false)

      // 设置实时订阅
      channel = supabase
        .channel('notes_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'temporary_contents',
            filter: `owner=eq.${user.id}`,
          },
          (payload) => {
            console.log('收到更新:', payload) // 用于调试
            if (payload.eventType === 'INSERT') {
              setNotes((prev) => [payload.new as Note, ...prev])
            } else if (payload.eventType === 'UPDATE') {
              setNotes((prev) =>
                prev.map((note) =>
                  note.id === payload.new.id ? (payload.new as Note) : note
                )
              )
            } else if (payload.eventType === 'DELETE') {
              console.log('删除事件:', payload) // 用于调试删除
              setNotes((prev) => {
                console.log('当前笔记:', prev) // 用于调试当前状态
                return prev.filter((note) => {
                  const shouldKeep = note.id !== payload.old.id
                  console.log(`笔记 ${note.id} 保留?: ${shouldKeep}`) // 用于调试过滤过程
                  return shouldKeep
                })
              })
            }
          }
        )
        .subscribe((status) => {
          console.log('订阅状态:', status)
        })
    }

    setupSubscription()

    // 清理函数
    return () => {
      if (channel) {
        console.log('清理订阅') // 用于调试
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  // 添加笔记
  const addNote = async (content: string) => {
    if (!content.trim()) return

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      if (!response.ok) {
        throw new Error('添加失败')
      }
    } catch (error) {
      console.error('添加笔记失败:', error)
    }
  }

  // 更新笔记
  const updateNote = async (id: string, content: string) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      if (!response.ok) {
        throw new Error('更新失败')
      }

      setIsDialogOpen(false)
      setEditingNote(null)
    } catch (error) {
      console.error('更新笔记失败:', error)
    }
  }

  // 删除笔记
  const deleteNote = async (id: string) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '删除失败')
      }

      // 立即更新本地状态
      setNotes(prev => prev.filter(note => note.id !== id))
    } catch (error) {
      console.error('删除笔记失败:', error)
      // 可以添加一个提示
      alert(error instanceof Error ? error.message : '删除失败')
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">快速记录</h1>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* 左侧输入区域 */}
        <div className="w-full md:w-1/3">
          <NoteInput onSubmit={addNote} />
        </div>
        
        {/* 右侧记录列表 */}
        <div className="w-full md:w-2/3">
          <NoteList 
            notes={notes} 
            loading={loading} 
            onEdit={(note) => {
              setEditingNote(note)
              setIsDialogOpen(true)
            }} 
            onDelete={deleteNote} 
          />
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editingNote && (
        <EditDialog 
          note={editingNote}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingNote(null)
          }}
          onSave={(content) => updateNote(editingNote.id, content)}
        />
      )}
    </div>
  )
}