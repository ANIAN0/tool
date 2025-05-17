'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { Search, Clipboard, RefreshCw, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Header from '@/components/header'

// 剪贴板项目类型
type ClipboardItem = {
  id: string
  type: 'text' | 'image' | 'file' | 'unknown'
  content: string
  timestamp: number
}

export default function ClipboardPage() {
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // 获取用户信息
  const getUserInfo = async () => {
    try {
      const response = await fetch('/api/user')
      if (response.ok) {
        const userData = await response.json()
        setUserEmail(userData.email)
        setIsAdmin(userData.email?.includes('admin') || false)
      }
    } catch (err) {
      console.error('获取用户信息失败:', err)
    }
  }

  // 从localStorage加载历史记录
  const loadHistory = () => {
    try {
      const history = localStorage.getItem('clipboardHistory')
      if (history) {
        setClipboardItems(JSON.parse(history))
      }
    } catch (err) {
      console.error('加载历史记录失败:', err)
    } finally {
      setLoading(false)  // 加载完成后设置 loading 为 false
    }
  }

  // 添加新项目函数
  const addNewItem = async (newItem: ClipboardItem): Promise<boolean> => {
    return new Promise(resolve => {
      setClipboardItems(prev => {
        // 检查是否已存在相同内容
        const exists = prev.some(item => 
          item.type === newItem.type && item.content === newItem.content
        )
        
        if (exists) {
          resolve(false)
          return prev
        }
        
        // 添加新项目并保留最新的5条记录
        const updated = [newItem, ...prev].slice(0, 5)
        // 保存到localStorage
        localStorage.setItem('clipboardHistory', JSON.stringify(updated))
        resolve(true)
        return updated
      })
    })
  }

  // 读取剪贴板函数
  const readClipboard = async () => {
    try {
      // 获取剪贴板内容
      const clipboardItems = await navigator.clipboard.read()
      let hasNewContent = false

      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          const blob = await clipboardItem.getType(type)
          
          if (type.startsWith('image/')) {
            const imageUrl = URL.createObjectURL(blob)
            hasNewContent = await addNewItem({
              id: Date.now().toString(),
              type: 'image',
              content: imageUrl,
              timestamp: Date.now()
            })
          } else if (type === 'text/plain') {
            const text = await blob.text()
            if (text && text.trim() !== '') {
              hasNewContent = await addNewItem({
                id: Date.now().toString(),
                type: 'text',
                content: text,
                timestamp: Date.now()
              })
            }
          }
        }
      }
  
      // 如果新API失败或没有新内容，尝试使用传统方法
      if (!hasNewContent) {
        const text = await navigator.clipboard.readText()
        if (text && text.trim() !== '') {
          await addNewItem({
            id: Date.now().toString(),
            type: 'text',
            content: text,
            timestamp: Date.now()
          })
        }
      }
    } catch (err) {
      throw err
    }
  }

  // 检查剪贴板权限
  const checkClipboardPermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ 
        name: 'clipboard-read' as PermissionName 
      })
      
      if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
        if (document.hasFocus()) {
          await readClipboard()
        }
      } else {
        setError('需要剪贴板访问权限')
      }
    } catch (err) {
      console.error('剪贴板访问错误:', err)
      setError('无法访问剪贴板')
    }
  }

  // 手动刷新函数
  const handleRefresh = async () => {
    setError(null)
    setRefreshing(true)
    try {
      await readClipboard()
    } catch (err) {
      console.error('刷新剪贴板失败:', err)
      setError('刷新剪贴板失败')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  // 清空历史记录
  const clearHistory = () => {
    setClipboardItems([])
    localStorage.removeItem('clipboardHistory')
  }

  // 初始化效果
  useEffect(() => {
    getUserInfo()
    loadHistory()
    checkClipboardPermission()
  }, [])

  // 焦点监听效果
  useEffect(() => {
    const handleFocus = () => {
      readClipboard()
    }
    
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // 清理图片URL
  useEffect(() => {
    return () => {
      clipboardItems.forEach(item => {
        if (item.type === 'image') URL.revokeObjectURL(item.content);
      });
    };
  }, [clipboardItems]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header email={userEmail} isAdmin={isAdmin} />
      
      <main className="flex-1 py-8">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Clipboard className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">剪贴板历史</h1>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={handleRefresh} 
                  disabled={refreshing || loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? '刷新中...' : '刷新剪贴板'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={clearHistory}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  清空历史
                </Button>
              </div>
            </div>
            
            <p className="text-muted-foreground">
              自动记录您复制的文本和图片，窗口获得焦点时自动更新
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </div>
          ) : clipboardItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clipboard className="h-16 w-16 mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-medium mb-2">暂无剪贴板历史记录</h3>
              <p className="text-muted-foreground max-w-md">
                复制文本或图片后将自动显示在这里，您也可以点击"刷新剪贴板"按钮手动更新
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {clipboardItems.map(item => (
                <ClipboardCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function ClipboardCard({ item }: { item: ClipboardItem }) {
  const formattedTime = new Date(item.timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  const handleSearch = () => {
    if (item.type === 'text') {
      window.open(`https://www.bing.com/search?q=${encodeURIComponent(item.content)}`, '_blank')
    }
  }

  const handleCopy = async () => {
    if (item.type === 'text') {
      await navigator.clipboard.writeText(item.content)
    }
  }

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex justify-between items-center text-base">
          <span className="flex items-center gap-1.5">
            {item.type === 'text' ? 
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">文本</span> : 
              <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full text-xs font-medium">图片</span>
            }
          </span>
          <span className="text-xs text-muted-foreground">{formattedTime}</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="max-h-48 overflow-auto break-words rounded-md bg-muted/40 p-3">
          {item.type === 'text' && item.content}
          {item.type === 'image' && (
            <div className="flex justify-center">
              <Image 
                src={item.content} 
                alt="剪贴板图片" 
                width={500}
                height={300}
                className="max-w-full h-auto object-contain rounded-md"
                onError={() => {
                  // 处理错误
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="mt-auto border-t pt-3">
        <div className="flex justify-end w-full gap-2">
          {item.type === 'text' && (
            <>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                复制
              </Button>
              <Button size="sm" variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
            </>
          )}
          {item.type === 'image' && (
            <Button size="sm" variant="outline" onClick={() => window.open(item.content, '_blank')}>
              查看原图
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
