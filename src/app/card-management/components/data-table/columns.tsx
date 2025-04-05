'use client'

import { ColumnDef } from "@tanstack/react-table"
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
// 修正导入路径为同级目录
import { type FunctionItem } from './data-table'

// 修正2：调整owner字段的数据结构访问方式
export const columns: ColumnDef<FunctionItem>[] = [
  {
    accessorKey: "name",
    header: "功能名称",
  },
  {
    accessorKey: "description",
    header: "描述",
  },
  {
    accessorKey: "updated_at",
    header: "更新时间",
    cell: ({ row }) => new Date(row.getValue("updated_at")).toLocaleString()
  },
  {
    accessorKey: "is_public",
    header: "可见性",
    cell: ({ row }) => row.getValue("is_public") ? "公开" : "私有"
  },
  {
    accessorKey: "sort_order",
    header: "排序",
  },
  {
    accessorKey: "url",
    header: "跳转链接",
  },
  {
    accessorKey: "owner",
    header: "创建人",
    cell: ({ row }) => row.getValue("owner")
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const functionData = row.original
      
      // 移除对table.options.meta的直接访问
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/card-management/${functionData.id}/edit`}>编辑</Link>
            </DropdownMenuItem>
            <DropdownMenuItem 
              // 使用客户端事件处理
              onClick={() => {
                if(confirm("确定要删除吗？")) {
                  fetch(`/api/functions/${functionData.id}`, { 
                    method: "DELETE" 
                  }).then(() => {
                    window.location.reload()
                  })
                }
              }}
            >
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]