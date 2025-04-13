"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { useFileShare } from "@/hooks/use-file-share"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Grid, List } from "lucide-react"
import Header from "@/components/header"
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone"
import FileListSection from "../file-share/components/FileListSection"

export default function FileSharePageV2() {
  // 定义状态
  const [viewType, setViewType] = useState<"grid" | "list">("grid")
  const [isDragActive, setIsDragActive] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  const router = useRouter()
  const supabase = createClient()
  
  // 使用增强版的文件上传Hook
  const {
    files,
    loading: uploadLoading,
    errors,
    fileError,
    uploadedFiles,
    isLoadingFiles,
    onEnhancedUpload,
    deleteFile,
    user,
    ...uploadProps
  } = useFileShare({
    bucketName: "public.files",
    path: "shared-files",
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    allowedMimeTypes: [
      "image/*",           // 图片文件
      "application/pdf",   // PDF文件
      "audio/*",           // 音频文件
      "video/*",           // 视频文件
      "text/markdown",     // Markdown文件
      "text/plain",        // 纯文本文件
    ],
    enableAutoRefresh: true
  })

  // 处理上传错误
  useEffect(() => {
    if (fileError) {
      toast.error("上传错误", {
        description: fileError,
      })
    }
  }, [fileError])

  // 处理文件删除
  const handleDeleteFile = async (id: string, path: string) => {
    try {
      await deleteFile(id, path)
      toast.success("删除成功", {
        description: "文件已成功删除",
      })
    } catch (err) {
      toast.error("删除失败", {
        description: err instanceof Error ? err.message : "删除文件时发生错误",
      })
    }
  }

  // 创建一个包装函数来处理拖拽状态
  const handleRootProps = useCallback(
    (props: any) => ({
      ...props,
      onDragEnter: (event: React.DragEvent) => {
        props.onDragEnter?.(event)
        setIsDragActive(true)
      },
      onDragLeave: (event: React.DragEvent) => {
        props.onDragLeave?.(event)
        setIsDragActive(false)
      },
      onDrop: (event: React.DragEvent) => {
        props.onDrop?.(event)
        setIsDragActive(false)
      },
    }),
    []
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 使用标准 Header */}
      <Header email={user?.email} isAdmin={false} />
      
      {/* 主内容区 */}
      <main className="flex-1 py-8 relative">
        {/* 添加拖拽全局提示 */}
        {isDragActive && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="p-8 rounded-lg bg-primary/10 border-2 border-dashed border-primary animate-pulse">
              <p className="text-xl font-medium text-primary">释放鼠标上传文件</p>
            </div>
          </div>
        )}

        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 添加页面标题和描述 */}
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">文件分享</h1>
            <p className="text-muted-foreground">
              上传并分享您的文件，支持图片、音频、视频、PDF等多种格式
            </p>
          </div>

          {/* 修改 Dropzone 部分 */}
          <div className="mb-8 transition-all duration-200 ease-in-out">
            <Dropzone 
              {...uploadProps}
              files={files}
              loading={uploadLoading}
              errors={errors}
              onUpload={onEnhancedUpload}
              className="border-2 hover:border-primary/50 transition-colors duration-200"
              getRootProps={(props) => handleRootProps(props)}
            >
              <DropzoneEmptyState />
              <DropzoneContent />
            </Dropzone>
          </div>
          
          {/* 优化文件列表区域 */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">已上传文件</h2>
              
              <div className="flex items-center gap-4">
                {/* 添加排序选项 */}
                <select 
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                >
                  <option value="date">按时间</option>
                  <option value="name">按名称</option>
                  <option value="size">按大小</option>
                </select>
                
                {/* 优化视图切换按钮 */}
                <div className="flex items-center rounded-md border border-input bg-background p-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setViewType("grid")}
                    className={`${viewType === "grid" ? "bg-primary/10 text-primary" : ""} transition-colors`}
                    title="网格视图"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setViewType("list")}
                    className={`${viewType === "list" ? "bg-primary/10 text-primary" : ""} transition-colors`}
                    title="列表视图"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* 添加动画过渡效果 */}
            <div className="transition-all duration-300 ease-in-out">
              <FileListSection 
                user={user}
                files={sortFiles(uploadedFiles, sortBy, sortOrder)}
                onDeleteFile={handleDeleteFile}
                isLoading={isLoadingFiles}
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
              文件分享系统 &copy; {new Date().getFullYear()}
            </p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <button className="hover:text-primary transition-colors">使用条款</button>
              <button className="hover:text-primary transition-colors">隐私政策</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// 添加排序函数
function sortFiles(files: any[], sortBy: string, order: 'asc' | 'desc') {
  return [...files].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'date':
        comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        break
      case 'size':
        comparison = b.size - a.size
        break
    }
    return order === 'asc' ? comparison : -comparison
  })
}
