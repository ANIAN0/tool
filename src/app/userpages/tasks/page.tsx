'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'

// 任务类型定义
interface Task {
  id: string
  content: string
  description: string | null
  type: '工作' | '学习' | '复盘'
  is_important: boolean
  is_urgent: boolean
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
  owner: string
}

// 任务表单数据类型
interface TaskFormData {
  content: string
  description: string
  type: '工作' | '学习' | '复盘'
  is_important: boolean
  is_urgent: boolean
  start_date: string
  end_date: string
}

// 获取优先级标签
const getPriorityLabel = (is_important: boolean, is_urgent: boolean) => {
  if (is_important && is_urgent) return { text: '重要紧急', color: 'bg-red-100 text-red-800' }
  if (is_important && !is_urgent) return { text: '重要不紧急', color: 'bg-blue-100 text-blue-800' }
  if (!is_important && is_urgent) return { text: '不重要紧急', color: 'bg-yellow-100 text-yellow-800' }
  return { text: '不重要不紧急', color: 'bg-gray-100 text-gray-800' }
}

// 获取任务类型颜色
const getTypeColor = (type: string) => {
  switch (type) {
    case '工作': return 'bg-green-100 text-green-800'
    case '学习': return 'bg-purple-100 text-purple-800'
    case '复盘': return 'bg-orange-100 text-orange-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<Task[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  
  // 表单数据
  const [formData, setFormData] = useState<TaskFormData>({
    content: '',
    description: '',
    type: '工作',
    is_important: false,
    is_urgent: false,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd')
  })

  // 获取当前周的日期范围
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // 获取任务列表
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      setUser(currentUser)
      
      if (!currentUser) {
        console.log('用户未登录，显示空白页面')
        setTasks([])
        return
      }

      const response = await fetch('/api/tasks')
      if (!response.ok) {
        throw new Error('获取任务失败')
      }
      
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 搜索任务
  const searchTasks = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        console.log('用户未登录，无法搜索任务')
        setSearchResults([])
        setShowSearchResults(false)
        return
      }

      const response = await fetch(`/api/tasks/search?keyword=${encodeURIComponent(keyword)}`)
      if (!response.ok) {
        throw new Error('搜索失败')
      }
      
      const data = await response.json()
      setSearchResults(data)
      setShowSearchResults(true)
    } catch (error) {
      console.error('Error searching tasks:', error)
    }
  }, [])

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTasks(searchKeyword)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchKeyword, searchTasks])

  // 初始化加载
  useEffect(() => {
    fetchTasks()
  }, [])

  // 创建或更新任务
  const handleSaveTask = async () => {
    try {
      setSaving(true)
      
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks'
      const method = editingTask ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '保存失败')
      }
      
      await fetchTasks()
      setIsDrawerOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error saving task:', error)
      alert(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除任务
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '删除失败')
      }
      
      await fetchTasks()
      setIsDrawerOpen(false)
    } catch (error) {
      console.error('Error deleting task:', error)
      alert(error instanceof Error ? error.message : '删除失败')
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      content: '',
      description: '',
      type: '工作',
      is_important: false,
      is_urgent: false,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd')
    })
    setEditingTask(null)
  }

  // 打开新建任务抽屉
  const openCreateDrawer = (date?: Date) => {
    resetForm()
    if (date) {
      setFormData(prev => ({
        ...prev,
        start_date: format(date, 'yyyy-MM-dd'),
        end_date: format(date, 'yyyy-MM-dd')
      }))
    }
    setIsDrawerOpen(true)
  }

  // 打开编辑任务抽屉
  const openEditDrawer = (task: Task) => {
    setEditingTask(task)
    setFormData({
      content: task.content,
      description: task.description || '',
      type: task.type,
      is_important: task.is_important,
      is_urgent: task.is_urgent,
      start_date: task.start_date,
      end_date: task.end_date
    })
    setIsDrawerOpen(true)
  }

  // 获取指定日期的任务
  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return tasks.filter(task => {
      return dateStr >= task.start_date && dateStr <= task.end_date
    })
  }

  // 获取任务在时间线中的显示信息
  const getTaskDisplayInfo = () => {
    const taskDisplayMap = new Map<string, {
      task: Task
      startCol: number
      endCol: number
      spanWidth: number
    }>()

    tasks.forEach(task => {
      // 计算任务跨越的列范围
      let startCol = -1
      let endCol = -1
      
      weekDays.forEach((day, dayIndex) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        if (dayStr >= task.start_date && dayStr <= task.end_date) {
          if (startCol === -1) startCol = dayIndex
          endCol = dayIndex
        }
      })
      
      if (startCol !== -1) {
        taskDisplayMap.set(task.id, {
          task,
          startCol,
          endCol,
          spanWidth: endCol - startCol + 1
        })
      }
    })

    return taskDisplayMap
  }



  // 周导航
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => addDays(prev, direction === 'next' ? 7 : -7))
  }

  return (
    <div className="flex h-screen bg-gray-50/50">
      {/* 侧边栏 */}
      <AppSidebar />
      
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">任务管理</h1>
              
              {/* 周导航 */}
              <div className="flex items-center space-x-3 bg-gray-50/80 rounded-xl p-1">
                <Button variant="ghost" size="sm" onClick={() => navigateWeek('prev')} className="h-8 w-8 p-0 hover:bg-white/80">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-4 py-1 text-gray-700 min-w-[140px] text-center">
                  {format(weekStart, 'M月d日')} - {format(weekEnd, 'M月d日')}
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigateWeek('next')} className="h-8 w-8 p-0 hover:bg-white/80">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* 搜索和新建 */}
            <div className="flex items-center space-x-4">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={user ? "搜索任务..." : "请先登录"}
                  value={searchKeyword}
                  onChange={(e) => user && setSearchKeyword(e.target.value)}
                  disabled={!user}
                  className="pl-10 w-72 h-10 border-gray-200/60 bg-gray-50/50 focus:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                    {searchResults.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 hover:bg-gray-50/80 cursor-pointer border-b border-gray-100/60 last:border-b-0 transition-colors"
                        onClick={() => {
                          // 滚动到任务开始日期
                          const taskStartDate = new Date(task.start_date)
                          const startOfTaskWeek = startOfWeek(taskStartDate, { weekStartsOn: 1 })
                          setCurrentWeek(startOfTaskWeek)
                          setShowSearchResults(false)
                          setSearchKeyword('')
                        }}
                      >
                        <div className="font-medium text-sm text-gray-900">{task.content}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {format(new Date(task.start_date), 'M月d日')} - 
                          {format(new Date(task.end_date), 'M月d日')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <Button 
                onClick={() => user ? openCreateDrawer() : window.location.href = '/auth/login'} 
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                {user ? '新建任务' : '登录后新建'}
              </Button>
            </div>
          </div>
        </div>
        
        {/* 时间线内容 */}
        <div className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : !user ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-gray-500 mb-4">请登录后查看和管理您的任务</div>
                <Button 
                  onClick={() => window.location.href = '/auth/login'}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  前往登录
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-3 h-full">
              {(() => {
                const taskDisplayMap = getTaskDisplayInfo()
                
                return weekDays.map((day, dayIndex) => {
                  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  
                  // 获取在此列开始的任务
                  const tasksStartingHere = Array.from(taskDisplayMap.values())
                    .filter(info => info.startCol === dayIndex)
                  
                  return (
                    <div key={dayIndex} className="flex flex-col">
                      {/* 日期头部 */}
                      <div className={cn(
                        "text-center p-4 rounded-xl mb-4 transition-colors",
                        isToday 
                          ? "bg-blue-50/80 border-2 border-blue-200/60" 
                          : "bg-white/60 border-2 border-gray-100/60"
                      )}>
                        <div className="text-xs text-gray-500 uppercase font-medium tracking-wide mb-1">
                          {format(day, 'EEE')}
                        </div>
                        <div className={cn(
                          "text-xl font-semibold",
                          isToday ? "text-blue-600" : "text-gray-900"
                        )}>
                          {format(day, 'd')}
                        </div>
                      </div>
                      
                      {/* 任务列表 */}
                      <div 
                        className="flex-1 space-y-4 min-h-[400px] p-0 cursor-pointer hover:bg-white/60 transition-all duration-200 relative"
                        onClick={() => openCreateDrawer(day)}
                      >
                        {/* 渲染任务卡片 */}
                        {tasksStartingHere.map((info, index) => {
                          const { task, spanWidth } = info
                          const cardWidth = spanWidth > 1 
                            ? `calc(${spanWidth * 100}% + ${(spanWidth - 1) * 0.75}rem)`
                            : '100%'
                          
                          return (
                            <Card 
                              key={task.id}
                              className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-gray-200/60 bg-white/90 backdrop-blur-sm mb-4 py-0"
                              style={{
                                width: cardWidth,
                                position: spanWidth > 1 ? 'absolute' : 'relative',
                                left: spanWidth > 1 ? 0 : 'auto',
                                zIndex: spanWidth > 1 ? 10 : 'auto',
                                top: spanWidth > 1 ? `${index * 9}rem` : 'auto',
                                height: '8rem'
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditDrawer(task)
                              }}
                            >
                              <CardContent className="p-3 h-full flex flex-col">
                                {/* 标签区域 */}
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                  <Badge className={`${getTypeColor(task.type)} text-xs font-medium px-2 py-0.5 rounded-md`} variant="secondary">
                                    {task.type}
                                  </Badge>
                                  <Badge className={`${getPriorityLabel(task.is_important, task.is_urgent).color} text-xs font-medium px-2 py-0.5 rounded-md`} variant="secondary">
                                    {getPriorityLabel(task.is_important, task.is_urgent).text}
                                  </Badge>
                                  {(() => {
                                    // 计算任务实际天数
                                    const startDate = new Date(task.start_date)
                                    const endDate = new Date(task.end_date)
                                    const diffTime = endDate.getTime() - startDate.getTime()
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
                                    return diffDays > 1 && (
                                      <span className="text-xs bg-blue-100/80 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                        {diffDays}天
                                      </span>
                                    )
                                  })()} 
                                </div>
                                
                                {/* 任务内容 */}
                                <div className="font-medium text-sm text-gray-900 mb-1">
                                  {task.content}
                                </div>
                                
                                {/* 任务描述 */}
                                {task.description && (
                                  <div className="text-xs text-gray-500">
                                    {task.description}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                        
                        {tasksStartingHere.length === 0 && (
                          <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
                            <div className="text-center">
                              <Plus className="h-6 w-6 mx-auto mb-2 opacity-50" />
                              <div>点击添加任务</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              })()
              }
            </div>
          )}
        </div>
      </div>
      
      {/* 任务编辑抽屉 */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{editingTask ? '编辑任务' : '新建任务'}</SheetTitle>
            <SheetDescription>
              {editingTask ? '修改任务信息并保存更改。' : '填写任务信息并创建新任务。'}
            </SheetDescription>
          </SheetHeader>
          
          <div className="grid flex-1 auto-rows-min gap-4 py-4 px-4">
            {/* 任务内容 */}
            <div className="grid gap-2">
              <Label htmlFor="content">任务内容 *</Label>
              <Textarea
                id="content"
                placeholder="请输入任务内容"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={3}
                className="resize-none"
              />
            </div>
            
            {/* 任务描述 */}
            <div className="grid gap-2">
              <Label htmlFor="description">任务描述</Label>
              <Textarea
                id="description"
                placeholder="请输入任务描述（可选）"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>
            
            {/* 任务类型 */}
            <div className="grid gap-3">
              <Label>任务类型 *</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as '工作' | '学习' | '复盘' }))}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="工作" id="work" />
                  <Label htmlFor="work" className="cursor-pointer">工作</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="学习" id="study" />
                  <Label htmlFor="study" className="cursor-pointer">学习</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="复盘" id="review" />
                  <Label htmlFor="review" className="cursor-pointer">复盘</Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* 日期范围 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">开始日期 *</Label>
                <div className="relative">
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="cursor-pointer"
                    onClick={(e) => {
                      const input = e.target as HTMLInputElement;
                      input.showPicker?.();
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date">结束日期 *</Label>
                <div className="relative">
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="cursor-pointer"
                    onClick={(e) => {
                      const input = e.target as HTMLInputElement;
                      input.showPicker?.();
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* 优先级 */}
            <div className="grid gap-3">
              <Label>优先级</Label>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="important"
                    checked={formData.is_important}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_important: checked as boolean }))}
                  />
                  <Label htmlFor="important" className="cursor-pointer">重要</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="urgent"
                    checked={formData.is_urgent}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_urgent: checked as boolean }))}
                  />
                  <Label htmlFor="urgent" className="cursor-pointer">紧急</Label>
                </div>
              </div>
            </div>
          </div>
          
          <SheetFooter className="flex-col sm:flex-row gap-2">
            {editingTask && (
              <Button 
                variant="destructive" 
                onClick={() => handleDeleteTask(editingTask.id)}
                className="w-full sm:w-auto"
              >
                删除任务
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 sm:flex-none"
              >
                取消
              </Button>
              <Button 
                onClick={handleSaveTask} 
                disabled={saving || !formData.content.trim()}
                className="flex-1 sm:flex-none"
              >
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}