"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { LogOut, LogIn, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'  // 添加这行

interface HeaderProps {
  email?: string
  isAdmin?: boolean
}

export default function Header({ email, isAdmin }: HeaderProps) {
  const router = useRouter()
  const isLoggedIn = !!email
  const [isHomeHovered, setIsHomeHovered] = useState(false)  // 添加状态

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login') // 修改为正确的登录路径
      router.refresh()
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  const handleLogin = () => {
    router.push('/auth/login')  // 修改为正确的登录路径
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href={isLoggedIn ? "/protected" : "/"} className="flex items-center gap-2">
            <span className="text-xl font-bold">Nianian Toool.</span>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push(isLoggedIn ? "/protected" : "/")}
            onMouseEnter={() => setIsHomeHovered(true)}
            onMouseLeave={() => setIsHomeHovered(false)}
            className={cn(
              "transition-colors duration-200",
              isHomeHovered ? "bg-accent text-accent-foreground" : ""
            )}
          >
            <Home className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline-block">{email}</span>
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/card-management">管理功能</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-1">
                <LogOut className="h-4 w-4" />
                <span>退出登录</span>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLogin} className="flex items-center gap-1">
              <LogIn className="h-4 w-4" />
              <span>登录</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}