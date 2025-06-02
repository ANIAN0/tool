'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Settings, LogOut } from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Menu {
  id: string
  name: string
  url: string
  icon: string | null
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

interface AppSidebarProps {
  menus?: Menu[]
  onMenuClick?: (url: string) => void
}

export function AppSidebar({ menus: propMenus, onMenuClick: propOnMenuClick }: AppSidebarProps) {
  const router = useRouter()
  const [menus, setMenus] = React.useState<Menu[]>([])
  const [userEmail, setUserEmail] = React.useState<string | null>(null)

  // 获取用户信息
  React.useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || null)
    }
    getUser()
  }, [])

  // 获取菜单列表
  React.useEffect(() => {
    if (propMenus) {
      setMenus(propMenus)
      return
    }

    const fetchMenus = async () => {
      try {
        const response = await fetch('/api/menus')
        if (!response.ok) {
          throw new Error('获取菜单失败')
        }
        const data = await response.json()
        setMenus(data)
      } catch (error) {
        console.error('Error loading menus:', error)
      }
    }

    fetchMenus()
  }, [propMenus])

  // 获取图标组件
  const getIconComponent = (iconName: string | null) => {
    switch (iconName) {
      case 'calendar':
        return <Calendar className="h-4 w-4" />
      case 'settings':
        return <Settings className="h-4 w-4" />
      default:
        return null
    }
  }

  // 处理菜单点击
  const handleMenuClick = (url: string) => {
    if (propOnMenuClick) {
      propOnMenuClick(url)
    } else {
      router.push(url)
    }
  }

  // 处理退出登录
  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  // 获取用户头像首字母
  const getAvatarFallback = (email: string | null) => {
    if (!email) return '登'
    const firstChar = email.charAt(0).toUpperCase()
    return /[a-zA-Z]/.test(firstChar) ? firstChar : '无'
  }

  return (
    <div className="w-[60px] h-full border-r bg-[#fafafa] flex flex-col">
      {/* 头部 */}
      <div className="p-1">
        <div className="flex items-center justify-center">
          <img 
            src="https://img.picgo.net/2025/06/02/-1491x-190a0dc4366d5177d.png" 
            alt="Logo" 
            className="h-10 w-auto" 
          />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-1">
        <div className="flex flex-col gap-1">
          <ul className="flex flex-col gap-1">
            {menus.map((menu) => (
              <li key={menu.id} className="relative">
                <Button 
                  variant="ghost" 
                  className="w-full justify-center p-0 h-8 text-sm hover:bg-white"
                  onClick={() => handleMenuClick(menu.url)}
                >
                  <span className="truncate">{menu.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 底部 */}
      <div className="border-t p-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-center p-0">
              <Avatar className="h-6 w-6">
                <AvatarImage src={userEmail ? `https://avatar.vercel.sh/${userEmail}` : undefined} />
                <AvatarFallback>{getAvatarFallback(userEmail)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}