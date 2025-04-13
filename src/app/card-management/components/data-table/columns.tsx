"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, Globe, Lock, Calendar } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet"
import { FunctionForm } from "../function-form"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// 定义功能数据类型
export interface Function {
  id: string
  name: string
  url: string
  description?: string
  is_public: boolean
  sort_order: number
  updated_at: string
  owner: string
}

// 扩展 TableMeta 类型
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends unknown> {
    currentUserId?: string
    onDelete?: (id: string) => void
    refreshData?: () => void
  }
}

export const columns: ColumnDef<Function>[] = [
  {
    accessorKey: "name",
    header: "功能名称",
    cell: ({ row }) => {
      return (
        <div className="font-medium">{row.getValue("name")}</div>
      )
    },
  },
  {
    accessorKey: "description",
    header: "描述",
    cell: ({ row }) => {
      const description = row.getValue("description") as string
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="max-w-[200px] truncate text-muted-foreground">
                {description || "-"}
              </div>
            </TooltipTrigger>
            {description && (
              <TooltipContent>
                <p className="max-w-xs">{description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  {
    accessorKey: "url",
    header: "跳转链接",
    cell: ({ row }) => {
      const url = row.getValue("url") as string
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="max-w-[150px] truncate text-muted-foreground">
                {url}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{url}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  {
    accessorKey: "is_public",
    header: "可见性",
    cell: ({ row }) => {
      const isPublic = row.getValue("is_public") as boolean
      return isPublic ? (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
          <Globe className="h-3 w-3" />
          <span>公共</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          <span>私有</span>
        </Badge>
      )
    },
  },
  {
    accessorKey: "sort_order",
    header: "排序",
    cell: ({ row }) => {
      return <div className="text-center font-mono">{row.getValue("sort_order")}</div>
    },
  },
  {
    accessorKey: "updated_at",
    header: "更新时间",
    cell: ({ row }) => {
      const date = new Date(row.getValue("updated_at") as string)
      const formattedDate = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{formattedDate}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "owner",
    header: "创建人",
    size: 100, // 减小创建人列的宽度
    cell: ({ row }) => {
      return <div className="text-muted-foreground">{row.getValue("owner")}</div>
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">操作</div>,
    cell: ({ row, table }) => {
      const { currentUserId, onDelete, refreshData } = table.options.meta || {}
      const function_ = row.original
      const [isEditing, setIsEditing] = useState(false)
      
      // 检查当前用户是否有权限编辑/删除
      const canModify = currentUserId === function_.owner || function_.is_public
      
      // 处理编辑提交
      const handleEdit = async (formData: Partial<Function>) => {
        try {
          const response = await fetch(`/api/functions/${function_.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            return { error: errorData.error || '更新失败' }
          }
          
          toast.success('更新成功', {
            description: '功能卡片已成功更新',
          })
          
          setIsEditing(false)
          // 刷新表格数据
          if (table.options.meta?.refreshData) {
            table.options.meta.refreshData()
          }
          return {}
        } catch (err) {
          return { error: err instanceof Error ? err.message : '未知错误' }
        }
      }

      if (!canModify) {
        return null
      }

      return (
        <div className="text-right">
          <Sheet open={isEditing} onOpenChange={setIsEditing}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">操作菜单</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuLabel>操作</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SheetTrigger asChild>
                  <DropdownMenuItem className="cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑
                  </DropdownMenuItem>
                </SheetTrigger>
                <DropdownMenuItem
                  onClick={() => {
                    if (window.confirm(`确定要删除 "${function_.name}" 吗?`)) {
                      onDelete?.(function_.id)
                    }
                  }}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <SheetContent className="sm:max-w-[450px]">
              <SheetHeader className="pb-4 border-b px-5">
                <SheetTitle className="text-xl">编辑功能</SheetTitle>
                <SheetDescription className="text-muted-foreground">
                  修改功能卡片信息，完成后点击保存。
                </SheetDescription>
              </SheetHeader>
              <div className="py-6 px-5 overflow-y-auto max-h-[calc(100vh-200px)]">
                <FunctionForm 
                  initialData={function_}
                  onSubmit={handleEdit}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )
    },
  },
]
