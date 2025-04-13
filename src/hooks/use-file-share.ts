import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
// 移除 @supabase/auth-helpers-react 导入
import { v4 as uuidv4 } from 'uuid'
import { useSupabaseUpload, type UseSupabaseUploadOptions } from './use-supabase-upload'

// 创建 Supabase 客户端
const supabase = createClient()

// 更新 FileItem 接口以匹配数据库表结构
interface FileItem {
  id: string
  created_at: string
  name: string          // 原始文件名
  path: string
  size: number
  type: string
  user_id: string      // 改为 user_id
  user_email: string
  public_url: string
}

interface UseFileShareOptions extends UseSupabaseUploadOptions {
  enableAutoRefresh?: boolean
}

export function useFileShare(options: UseFileShareOptions) {
  const {
    enableAutoRefresh = true,
    ...uploadOptions
  } = options
  
  // 使用 useState 管理用户状态，而不是 useUser hook
  const [user, setUser] = useState<any>(null)
  
  // 移除 files 属性，因为它不在 UseSupabaseUploadOptions 中
  const baseUpload = useSupabaseUpload({
    ...uploadOptions
  })
  
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  // 获取当前用户
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
    }
    
    getUser()
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null)
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 生成唯一文件名
  const generateUniqueFileName = useCallback((fileName: string) => {
    const fileExt = fileName.split('.').pop() || '';
    const uniqueId = uuidv4();
    return `${uniqueId}.${fileExt}`;
  }, [])

  // 增强的上传方法
  // 修改文件上传处理逻辑
  const handleUpload = useCallback(async () => {
    if (!user) {
      setFileError('请先登录')
      return
    }
    
    const files = baseUpload.files || []
    
    if (files.length === 0) {
      setFileError('请选择文件')
      return
    }
    
    try {
      const uploadPromises = files.map(async (file) => {
        // 生成唯一文件名
        const uniqueFileName = generateUniqueFileName(file.name)
        const filePath = options.path 
          ? `${options.path}/${uniqueFileName}` 
          : uniqueFileName

        // 上传文件到存储
        const { error: uploadError } = await supabase.storage
          .from(options.bucketName)
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`文件上传失败: ${uploadError.message}`)
        }

        // 获取公共URL
        const { data: { publicUrl } } = supabase.storage
          .from(options.bucketName)
          .getPublicUrl(filePath)

        // 通过API更新数据库
        const response = await fetch('/api/files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: file.name,        // 保存原始文件名
            path: filePath,         // 保存系统生成的路径
            size: Math.floor(file.size), // 确保 size 是整数
            type: file.type,
            public_url: publicUrl
          })
        })

        if (!response.ok) {
          // 如果API请求失败，删除已上传的文件
          await supabase.storage
            .from(options.bucketName)
            .remove([filePath])
            
          const errorData = await response.json()
          throw new Error(errorData.error || '数据库更新失败')
        }

        return filePath
      })

      await Promise.all(uploadPromises)
      
      // 清空文件列表
      baseUpload.setFiles([])
      
      // 刷新文件列表
      if (enableAutoRefresh) {
        fetchFiles()
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : '上传失败')
    }
  }, [baseUpload, user, options.bucketName, options.path, enableAutoRefresh, generateUniqueFileName])

  // 修改获取文件列表的逻辑，通过API获取
  const fetchFiles = useCallback(async () => {
    if (!user) return
    
    setIsLoadingFiles(true)
    try {
      const response = await fetch('/api/files')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取文件列表失败')
      }
      
      const data = await response.json()
      setUploadedFiles(data)
    } catch (err) {
      console.error('获取文件列表失败:', err)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [user])

  // 修改删除文件的逻辑，通过API删除
  const deleteFile = useCallback(async (fileId: string, filePath: string) => {
    if (!user) {
      setFileError('请先登录')
      return
    }
    
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除文件失败')
      }
      
      // 更新本地状态
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
    } catch (err) {
      setFileError(err instanceof Error ? err.message : '删除文件失败')
      throw err
    }
  }, [user])

  // 初始加载和用户变化时获取文件
  useEffect(() => {
    if (user) {
      fetchFiles()
    }
  }, [user, fetchFiles])

  // 在返回对象中添加调试信息
  const { files, errors, ...restBaseUpload } = baseUpload
  
  return {
    files: files || [], // 确保 files 始终是数组
    errors: errors || [], // 确保 errors 始终是数组
    ...restBaseUpload,  // 展开其他 baseUpload 属性
    // 添加调试信息
    __debug: {
      baseUploadFiles: files,
      baseUploadErrors: errors,
      baseUploadType: typeof files,
      baseUploadKeys: Object.keys(baseUpload)
    },
    // 增强的属性和方法
    user,
    uploadedFiles,
    isLoadingFiles,
    fileError,
    onEnhancedUpload: handleUpload,
    deleteFile,
    refreshFiles: fetchFiles,
    generateUniqueFileName
  }
}
