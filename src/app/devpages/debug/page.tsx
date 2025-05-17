"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"
import { UserIcon, LayoutIcon, MousePointerIcon, UploadIcon } from "lucide-react"
import { BookOpenIcon } from "lucide-react"
import ExtensionGuideSection from "./components/sections/ExtensionGuideSection"
import { LoaderIcon } from "lucide-react"
import LoadingSection from "./components/sections/LoadingSection"

// 导入布局和各个部分组件
import DebugLayout from "./components/DebugLayout"
import UserAuthSection from "./components/sections/UserAuthSection"
import LayoutSection from "./components/sections/LayoutSection"
import InteractionSection from "./components/sections/InteractionSection"
import UploadSection from "./components/sections/UploadSection"

export default function DebugPage() {
  // 定义用户状态
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  const router = useRouter()
  const supabase = createClient()
  
  // 获取用户登录状态 - 标准实现方式
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
        }
      } catch (error) {
        console.error('获取用户会话失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkUser()
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])
  
  // 初始化文件上传 Hook
  const uploadProps = useSupabaseUpload({
    bucketName: "public.files",
    path: user?.id ? `users/${user.id}/debug-uploads` : "debug-uploads",
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
    allowedMimeTypes: [
      "image/*",           // 图片文件
      "application/pdf",   // PDF文件
      "audio/*",           // 语音文件
      "text/markdown",     // Markdown文件
      "text/plain",        // 纯文本文件(部分md文件可能被识别为此类型)
    ],
  })

  // 定义各个部分
  const sections = [
    {
      id: "auth",
      title: "用户认证",
      icon: <UserIcon className="h-4 w-4" />,
      content: <UserAuthSection user={user} />
    },
    {
      id: "layout",
      title: "页面布局",
      icon: <LayoutIcon className="h-4 w-4" />,
      content: <LayoutSection />
    },
    {
      id: "interaction",
      title: "交互效果",
      icon: <MousePointerIcon className="h-4 w-4" />,
      content: <InteractionSection />
    },
    {
      id: "upload",
      title: "文件上传",
      icon: <UploadIcon className="h-4 w-4" />,
      content: <UploadSection user={user} uploadProps={uploadProps} />
    },
    {
      id: "extension-guide",
      title: "扩展指南",
      icon: <BookOpenIcon className="h-4 w-4" />,
      content: <ExtensionGuideSection />
    },
    {
      id: "loading",
      title: "加载动画",
      icon: <LoaderIcon className="h-4 w-4" />,
      content: <LoadingSection />
    }
  ]

  return <DebugLayout user={user} loading={loading} sections={sections} />
}
