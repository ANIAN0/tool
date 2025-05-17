"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NoteInput from './components/note-input'
import NoteList from './components/note-list'
import EditDialog from './components/edit-dialog'
import { redirect } from 'next/navigation'
import { RealtimeChannel } from '@supabase/realtime-js'
import Header from '@/components/header'
import { StickyNote, Plus, Search, Filter, SortAsc, SortDesc, Grid, List } from 'lucide-react'
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

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
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'created' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewType, setViewType] = useState<'grid' | 'list'>('list')
  const supabase = createClient()

  // 加载笔记
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        redirect('/auth/login')
        return
      }
      
      // 设置用户信息
      setUserEmail(user.email)
      setIsAdmin(user.email?.includes('admin') || false)

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

  // 过滤和排序笔记
  const filteredAndSortedNotes = notes
    .filter(note => 
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(sortBy === 'updated' ? a.updated_at : a.created_at)
      const dateB = new Date(sortBy === 'updated' ? b.updated_at : b.created_at)
      return sortOrder === 'desc' ? 
        dateB.getTime() - dateA.getTime() : 
        dateA.getTime() - dateB.getTime()
    })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header email={userEmail} isAdmin={isAdmin} />
      
      <main className="flex-1 py-8">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 页面标题区域 */}
          <div className="mb-8 space-y-4">
            <div className="flex items-center gap-2">
              <StickyNote className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">快速记录</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              随时记录您的想法和灵感，支持实时同步。使用快捷键 Ctrl/⌘ + Enter 快速保存，
              Shift + Enter 换行。
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧输入区域 */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24 space-y-4">
                <NoteInput onSubmit={addNote} />
                
                {/* 添加快捷操作提示 */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium">快捷操作</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Enter: 快速提交</li>
                    <li>• Shift + Enter: 换行</li>
                    <li>• Ctrl/⌘ + Enter: 编辑时保存</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* 右侧记录列表 */}
            <div className="lg:col-span-2 space-y-4">
              {/* 工具栏 */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索记录..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-full sm:w-[250px]"
                  />
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select
                    value={sortBy}
                    onValueChange={(value: 'created' | 'updated') => setSortBy(value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="排序方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">最后更新</SelectItem>
                      <SelectItem value="created">创建时间</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                    className="shrink-0"
                  >
                    {sortOrder === 'desc' ? 
                      <SortDesc className="h-4 w-4" /> : 
                      <SortAsc className="h-4 w-4" />
                    }
                  </Button>
                  
                  <div className="flex items-center rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewType('grid')}
                      className={viewType === 'grid' ? 'bg-muted' : ''}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewType('list')}
                      className={viewType === 'list' ? 'bg-muted' : ''}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <NoteList 
                notes={filteredAndSortedNotes}
                loading={loading}
                onEdit={(note) => {
                  setEditingNote(note)
                  setIsDialogOpen(true)
                }}
                onDelete={deleteNote}
                viewType={viewType}
              />
            </div>
          </div>
        </div>
      </main>
      
      {/* 优化页脚 */}
      <footer className="py-6 border-t bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              快速记录 &copy; {new Date().getFullYear()}
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                使用帮助
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                隐私政策
              </button>
            </div>
          </div>
        </div>
      </footer>

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
