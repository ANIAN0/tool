"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import FileSaver from "file-saver"
import { Download, Plus, X } from "lucide-react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// 定义任务类型
type TaskStatus = "not-started" | "in-progress" | "completed"
type TaskPriority = "important-urgent" | "important-not-urgent" | "not-important-urgent" | "not-important-not-urgent"

interface Task {
  id: string
  content: string
  priority: TaskPriority
  status: TaskStatus
  startTime: string | null
  endTime: string | null
  createdAt: string
}

// 象限标题映射
const quadrantTitles = {
  "important-urgent": "重要且紧急",
  "important-not-urgent": "重要不紧急",
  "not-important-urgent": "紧急不重要",
  "not-important-not-urgent": "不重要不紧急",
}

// 象限颜色映射 - 更新为更柔和的颜色
const quadrantColors = {
  "important-urgent": "text-rose-600 border-rose-200",
  "important-not-urgent": "text-blue-600 border-blue-200",
  "not-important-urgent": "text-amber-600 border-amber-200",
  "not-important-not-urgent": "text-slate-600 border-slate-200",
}

// 状态颜色映射 - 新增
const statusColors = {
  "not-started": "border-l-4 border-l-gray-300",
  "in-progress": "border-l-4 border-l-blue-400",
  "completed": "border-l-4 border-l-green-400",
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskContent, setNewTaskContent] = useState("")
  const [importance, setImportance] = useState<"important" | "not-important">("important")
  const [urgency, setUrgency] = useState<"urgent" | "not-urgent">("urgent")
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const email = "hudou_hudou@163.com"

  // 从本地存储加载任务
  useEffect(() => {
    const storedTasks = localStorage.getItem("quadrant-tasks")
    if (storedTasks) {
      setTasks(JSON.parse(storedTasks))
    }

    // 检查是否是周一，如果是则清空任务
    const today = new Date()
    const lastClearDate = localStorage.getItem("last-clear-date")
    const isMonday = today.getDay() === 1 // 0 是周日，1 是周一

    if (isMonday) {
      const lastClear = lastClearDate ? new Date(lastClearDate) : null
      const isSameDay = lastClear
        ? lastClear.getDate() === today.getDate() &&
          lastClear.getMonth() === today.getMonth() &&
          lastClear.getFullYear() === today.getFullYear()
        : false

      if (!isSameDay) {
        // 是周一且今天还没清空过
        setTasks([])
        localStorage.setItem("last-clear-date", today.toISOString())
      }
    }
  }, [])

  // 保存任务到本地存储
  useEffect(() => {
    localStorage.setItem("quadrant-tasks", JSON.stringify(tasks))
  }, [tasks])

  // 添加新任务
  const addTask = () => {
    if (!newTaskContent.trim()) return

    const priority = `${importance}-${urgency}` as TaskPriority
    const newTask: Task = {
      id: Date.now().toString(),
      content: newTaskContent,
      priority,
      status: "not-started",
      startTime: null,
      endTime: null,
      createdAt: new Date().toISOString(),
    }

    setTasks([...tasks, newTask])
    setNewTaskContent("")
  }

  // 更新任务状态
  const updateTaskStatus = (taskId: string) => {
    setTasks(
      tasks.map((task) => {
        if (task.id === taskId) {
          if (task.status === "not-started") {
            return {
              ...task,
              status: "in-progress",
              startTime: new Date().toISOString(),
            }
          } else if (task.status === "in-progress") {
            return {
              ...task,
              status: "completed",
              endTime: new Date().toISOString(),
            }
          }
          // 如果已完成，点击不做任何改变
          return task
        }
        return task
      }),
    )
  }

  // 删除任务
  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter((task) => task.id !== taskId))
  }

  // 导出为JSON
  const exportToJson = () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" })
    FileSaver.saveAs(blob, `tasks-${format(new Date(), "yyyy-MM-dd")}.json`)
  }

  // 按象限分组任务
  const tasksByQuadrant = tasks.reduce(
    (acc, task) => {
      if (!acc[task.priority]) {
        acc[task.priority] = []
      }
      acc[task.priority].push(task)
      return acc
    },
    {} as Record<TaskPriority, Task[]>,
  )

  // 获取任务卡片的样式
  const getTaskCardStyle = (status: TaskStatus, priority: TaskPriority) => {
    const statusStyle = statusColors[status];
    const priorityBorder = quadrantColors[priority].split(" ")[1];
    
    switch (status) {
      case "not-started":
        return `bg-white ${statusStyle}`;
      case "in-progress":
        return `bg-blue-50 ${statusStyle}`;
      case "completed":
        return `bg-gray-50 text-gray-500 line-through ${statusStyle}`;
      default:
        return `bg-white ${statusStyle}`;
    }
  }

  // 渲染任务卡片
  const renderTaskCard = (task: Task) => (
    <div key={task.id} className="relative group mb-2 transition-all hover:translate-y-[-2px]">
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md w-full overflow-hidden",
          getTaskCardStyle(task.status, task.priority)
        )}
        onClick={() => updateTaskStatus(task.id)}
      >
        <CardContent className="p-2.5 py-2">
          <p className="font-medium text-sm break-words leading-snug">{task.content}</p>
          <div className="flex flex-wrap gap-x-3 mt-1.5">
            {task.startTime && (
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1.5"></span>
                {new Date(task.startTime).toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
            {task.endTime && (
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5"></span>
                {new Date(task.endTime).toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white shadow-sm"
        onClick={(e) => {
          e.stopPropagation()
          deleteTask(task.id)
        }}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Header
        email={isLoggedIn ? email : undefined}
        isAdmin={false}
      />

      <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 左侧：添加任务表单 */}
          <div className="w-full lg:w-1/3 space-y-6">
            <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xl font-bold mb-5 text-gray-800 flex items-center">
                <span className="inline-block w-1 h-6 bg-blue-500 rounded mr-2"></span>
                添加新任务
              </h2>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="task-content" className="text-sm font-medium">任务内容</Label>
                  <Textarea
                    id="task-content"
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    placeholder="输入任务内容..."
                    className="mt-1.5 focus-visible:ring-1 focus-visible:ring-blue-400 resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">重要性</Label>
                    <RadioGroup
                      value={importance}
                      onValueChange={(value) => setImportance(value as "important" | "not-important")}
                      className="flex flex-col gap-2 mt-1.5"
                    >
                      <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50">
                        <RadioGroupItem value="important" id="important" />
                        <Label htmlFor="important" className="cursor-pointer">重要</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50">
                        <RadioGroupItem value="not-important" id="not-important" />
                        <Label htmlFor="not-important" className="cursor-pointer">不重要</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">紧急性</Label>
                    <RadioGroup
                      value={urgency}
                      onValueChange={(value) => setUrgency(value as "urgent" | "not-urgent")}
                      className="flex flex-col gap-2 mt-1.5"
                    >
                      <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50">
                        <RadioGroupItem value="urgent" id="urgent" />
                        <Label htmlFor="urgent" className="cursor-pointer">紧急</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50">
                        <RadioGroupItem value="not-urgent" id="not-urgent" />
                        <Label htmlFor="not-urgent" className="cursor-pointer">不紧急</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <Button 
                  onClick={addTask} 
                  className="w-full flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                  添加任务
                </Button>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={exportToJson} 
              className="w-full flex items-center justify-center gap-2 py-6 border-dashed hover:border-blue-300 hover:bg-blue-50/50"
            >
              <Download className="h-4 w-4" />
              导出为JSON
            </Button>
          </div>

          {/* 右侧：坐标轴四象限 */}
          <div className="w-full lg:w-2/3">
            <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <span className="inline-block w-1 h-6 bg-blue-500 rounded mr-2"></span>
                  本周工作
                </h2>
                <span className="text-sm bg-gray-100 px-3 py-1.5 rounded-full text-gray-600">
                  共 {tasks.length} 项任务，
                  {tasks.filter((t) => t.status === "completed").length} 项已完成
                </span>
              </div>

              {/* 坐标轴四象限 - 使用固定布局 */}
              <div className="relative mt-10 mb-6 mx-6">
                {/* 坐标轴标签 */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-6 text-sm font-medium bg-white px-3 py-1 rounded-full shadow-sm border z-10">
                  重要
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-6 text-sm font-medium bg-white px-3 py-1 rounded-full shadow-sm border z-10">
                  不重要
                </div>
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-6 text-sm font-medium bg-white px-3 py-1 rounded-full shadow-sm border z-10">
                  紧急
                </div>
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-6 text-sm font-medium bg-white px-3 py-1 rounded-full shadow-sm border z-10">
                  不紧急
                </div>

                {/* 固定高度的容器 */}
                <div className="h-[600px] w-full relative">
                  {/* 固定的坐标轴 */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0 border-l-2 border-dashed border-gray-200 z-0"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0 border-t-2 border-dashed border-gray-200 z-0"></div>

                  {/* 四象限容器 - 使用绝对定位确保位置固定 */}
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 h-full">
                    {/* 第一象限：重要且紧急 */}
                    <div className="relative overflow-y-auto p-4" style={{ maxHeight: "300px" }}>
                      <div
                        className={cn(
                          "sticky top-0 left-0 font-semibold px-3 py-1.5 rounded-full bg-white shadow-sm z-10 mb-4 inline-block",
                          quadrantColors["important-urgent"],
                        )}
                      >
                        {quadrantTitles["important-urgent"]}
                      </div>
                      <div className="space-y-2 mt-2">
                        {tasksByQuadrant["important-urgent"]?.map(renderTaskCard)}
                        {!tasksByQuadrant["important-urgent"]?.length && (
                          <p className="text-sm text-muted-foreground italic bg-gray-50 p-3 rounded-md text-center">暂无任务</p>
                        )}
                      </div>
                    </div>

                    {/* 第二象限：重要不紧急 */}
                    <div className="relative overflow-y-auto p-4" style={{ maxHeight: "300px" }}>
                      <div
                        className={cn(
                          "sticky top-0 right-0 font-semibold px-3 py-1.5 rounded-full bg-white shadow-sm z-10 mb-4 inline-block float-right",
                          quadrantColors["important-not-urgent"],
                        )}
                      >
                        {quadrantTitles["important-not-urgent"]}
                      </div>
                      <div className="space-y-2 clear-both mt-2">
                        {tasksByQuadrant["important-not-urgent"]?.map(renderTaskCard)}
                        {!tasksByQuadrant["important-not-urgent"]?.length && (
                          <p className="text-sm text-muted-foreground italic bg-gray-50 p-3 rounded-md text-center">暂无任务</p>
                        )}
                      </div>
                    </div>

                    {/* 第三象限：紧急不重要 */}
                    <div className="relative overflow-y-auto p-4" style={{ maxHeight: "300px" }}>
                      <div className="space-y-2 mb-2">
                        {tasksByQuadrant["not-important-urgent"]?.map(renderTaskCard)}
                        {!tasksByQuadrant["not-important-urgent"]?.length && (
                          <p className="text-sm text-muted-foreground italic bg-gray-50 p-3 rounded-md text-center">暂无任务</p>
                        )}
                      </div>
                      <div
                        className={cn(
                          "sticky bottom-0 left-0 font-semibold px-3 py-1.5 rounded-full bg-white shadow-sm z-10 mt-4 inline-block",
                          quadrantColors["not-important-urgent"],
                        )}
                      >
                        {quadrantTitles["not-important-urgent"]}
                      </div>
                    </div>

                    {/* 第四象限：不重要不紧急 */}
                    <div className="relative overflow-y-auto p-4" style={{ maxHeight: "300px" }}>
                      <div className="space-y-2 mb-2">
                        {tasksByQuadrant["not-important-not-urgent"]?.map(renderTaskCard)}
                        {!tasksByQuadrant["not-important-not-urgent"]?.length && (
                          <p className="text-sm text-muted-foreground italic bg-gray-50 p-3 rounded-md text-center">暂无任务</p>
                        )}
                      </div>
                      <div
                        className={cn(
                          "sticky bottom-0 right-0 font-semibold px-3 py-1.5 rounded-full bg-white shadow-sm z-10 mt-4 inline-block float-right",
                          quadrantColors["not-important-not-urgent"],
                        )}
                      >
                        {quadrantTitles["not-important-not-urgent"]}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 border-t bg-white">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} 四象限任务管理系统</p>
        </div>
      </footer>
    </div>
  )
}
