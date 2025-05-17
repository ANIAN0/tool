"use client"

import { useState } from "react"
import { User } from "@supabase/supabase-js"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileIcon, Trash2, ExternalLink, Copy, Eye } from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
// 替换 useToast 导入为 Sonner
import { toast } from "sonner"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface FileItem {
  id: string
  created_at: string
  name: string
  path: string
  size: number
  type: string
  user_id: string      // 改为 user_id 以匹配数据库结构
  user_email: string
  public_url: string
}

interface FileListSectionProps {
  files: FileItem[]
  user: User | null
  onDeleteFile: (id: string, path: string) => Promise<void>
  isLoading: boolean
  viewType: "grid" | "list"
}

export default function FileListSection({ 
  user, 
  files, 
  onDeleteFile, 
  isLoading,
  viewType 
}: FileListSectionProps) {
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  // 移除 useToast hook

  const handleDelete = async (id: string, path: string) => {
    try {
      setDeleteLoading(id)
      await onDeleteFile(id, path)
    } finally {
      setDeleteLoading(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // 使用 Sonner 的 toast 替代原来的 toast
    toast.success("链接已复制", {
      description: "文件链接已复制到剪贴板",
    })
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return "image"
    } else if (type.startsWith("audio/")) {
      return "audio"
    } else if (type.startsWith("video/")) {
      return "video"
    } else if (type.includes("pdf")) {
      return "pdf"
    } else if (type.includes("markdown") || type.includes("md")) {
      return "markdown"
    } else {
      return "file"
    }
  }

  const renderFilePreview = (file: FileItem) => {
    const fileType = getFileIcon(file.type)
    
    if (fileType === "image") {
      return (
        <div className="relative h-32 w-full rounded-md overflow-hidden bg-muted">
          <Image 
            src={file.public_url} 
            alt={file.name}
            fill
            className="object-cover"
          />
        </div>
      )
    }
    
    const iconMap = {
      audio: "🎵",
      video: "🎬",
      pdf: "📄",
      markdown: "📝",
      file: "📁"
    }
    
    return (
      <div className="h-32 w-full rounded-md bg-muted flex items-center justify-center text-4xl">
        {iconMap[fileType as keyof typeof iconMap]}
      </div>
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    else return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  // 添加文件预览功能
  const renderPreviewContent = () => {
    if (!previewFile) return null
    
    const fileType = getFileIcon(previewFile.type)
    
    switch (fileType) {
      case "image":
        return (
          <div className="relative w-full max-h-[60vh] rounded-md overflow-hidden">
            <Image 
              src={previewFile.public_url} 
              alt={previewFile.name}
              fill
              className="object-contain"
            />
          </div>
        )
      case "audio":
        return (
          <div className="p-4 bg-muted rounded-md">
            <audio controls className="w-full">
              <source src={previewFile.public_url} type={previewFile.type} />
              您的浏览器不支持音频播放
            </audio>
          </div>
        )
      case "video":
        return (
          <div className="p-4 bg-muted rounded-md">
            <video controls className="w-full max-h-[60vh]">
              <source src={previewFile.public_url} type={previewFile.type} />
              您的浏览器不支持视频播放
            </video>
          </div>
        )
      case "pdf":
        return (
          <div className="p-4 bg-muted rounded-md h-[60vh]">
            <iframe 
              src={previewFile.public_url} 
              className="w-full h-full border-0"
              title={previewFile.name}
            />
          </div>
        )
      default:
        return (
          <div className="p-8 text-center">
            <FileIcon className="mx-auto h-16 w-16 opacity-50 mb-4" />
            <p>无法预览此类型的文件</p>
            <a 
              href={previewFile.public_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center text-primary hover:underline"
            >
              在新窗口中打开 <ExternalLink className="ml-1 h-4 w-4" />
            </a>
          </div>
        )
    }
  }

  // 添加动画类
  const gridItemClass = "transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
  const tableRowClass = "transition-colors hover:bg-muted/50"

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted mb-4" />
            <div className="h-4 w-32 bg-muted rounded mx-auto" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileIcon className="mx-auto h-16 w-16 opacity-30 mb-4 animate-bounce" />
            <h3 className="text-lg font-medium mb-2">暂无上传文件</h3>
            {!user && (
              <p className="text-sm">
                请
                <button className="text-primary hover:underline mx-1">登录</button>
                后上传文件
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {viewType === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => (
            <Card key={file.id} className={gridItemClass}>
              <CardContent className="p-3 space-y-2">
                {/* 文件预览区域增加动画效果 */}
                <div 
                  className="cursor-pointer overflow-hidden rounded-md group"
                  onClick={() => setPreviewFile(file)}
                >
                  <div className="relative">
                    {renderFilePreview(file)}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </h3>
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(file.public_url)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {(user?.id === file.user_id) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除文件</AlertDialogTitle>
                              <AlertDialogDescription>
                                此操作将永久删除该文件，且无法恢复。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(file.id, file.path)}
                                disabled={deleteLoading === file.id}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {deleteLoading === file.id ? "删除中..." : "删除"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(file.size)}</span>
                    <span>
                      {new Date(file.created_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="pt-1">
                    <a 
                      href={file.public_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center"
                    >
                      查看文件 <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">文件名</TableHead>
                  <TableHead className="w-[15%]">类型</TableHead>
                  <TableHead className="w-[15%]">大小</TableHead>
                  <TableHead className="w-[15%]">上传时间</TableHead>
                  <TableHead className="w-[15%] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id} className={tableRowClass}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {getFileIcon(file.type) === "image" ? "🖼️" : 
                           getFileIcon(file.type) === "audio" ? "🎵" : 
                           getFileIcon(file.type) === "video" ? "🎬" : 
                           getFileIcon(file.type) === "pdf" ? "📄" : 
                           getFileIcon(file.type) === "markdown" ? "📝" : "📁"}
                        </span>
                        <span className="truncate" title={file.name}>{file.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {file.type.split('/')[1]?.toUpperCase() || file.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(file.size)}</TableCell>
                    <TableCell>{new Date(file.created_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(file.public_url)}
                          title="复制链接"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <a 
                          href={file.public_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          title="打开文件"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        {(user?.id === file.user_id) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="删除文件">
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除文件</AlertDialogTitle>
                                <AlertDialogDescription>
                                  此操作将永久删除该文件，且无法恢复。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(file.id, file.path)}
                                  disabled={deleteLoading === file.id}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  {deleteLoading === file.id ? "删除中..." : "删除"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 优化预览对话框 */}
      <Dialog>
        <DialogContent className="max-w-4xl">
          {previewFile && (
            <>
              <DialogHeader className="space-y-4">
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-2xl">
                      {getFileIcon(previewFile.type) === "image" ? "🖼️" : 
                       getFileIcon(previewFile.type) === "audio" ? "🎵" : 
                       getFileIcon(previewFile.type) === "video" ? "🎬" : 
                       getFileIcon(previewFile.type) === "pdf" ? "📄" : 
                       getFileIcon(previewFile.type) === "markdown" ? "📝" : "📁"}
                    </span>
                    <span className="truncate font-medium">{previewFile.name}</span>
                  </div>
                </DialogTitle>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{formatFileSize(previewFile.size)}</span>
                  <span>上传于 {new Date(previewFile.created_at).toLocaleString('zh-CN')}</span>
                </div>
              </DialogHeader>
              
              <div className="relative mt-4">
                {renderPreviewContent()}
              </div>
              
              <div className="mt-4 flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(previewFile.public_url)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  复制链接
                </Button>
                <a 
                  href={previewFile.public_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  打开文件
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
