"use client"

import { useState } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, FileX } from 'lucide-react'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  currentUserId: string
  onDelete: (id: string) => void
  refreshData: () => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  currentUserId,
  onDelete,
  refreshData,
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
    meta: {
      currentUserId,
      onDelete,
      refreshData,
    },
  })

  return (
    <div className="w-full space-y-4">
      <div className="rounded-md border">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted">
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id} 
                      className="font-semibold text-foreground py-4 px-4 border-b border-border"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileX className="h-10 w-10 mb-2" />
                      <p>暂无数据</p>
                      <p className="text-sm">请添加新的功能卡片</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex-1 text-sm text-muted-foreground">
          共 <span className="font-medium">{table.getFilteredRowModel().rows.length}</span> 条记录
        </div>
        <div className="flex items-center space-x-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 p-0 rounded-full hover:bg-muted hover:text-primary transition-colors"
          >
            <span className="sr-only">上一页</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">
            第 <span className="text-primary">{table.getState().pagination.pageIndex + 1}</span> 页，
            共 <span className="text-primary">{table.getPageCount()}</span> 页
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 p-0 rounded-full hover:bg-muted hover:text-primary transition-colors"
          >
            <span className="sr-only">下一页</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
