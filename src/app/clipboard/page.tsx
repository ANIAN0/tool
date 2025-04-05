'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { Search } from 'lucide-react'
import Image from 'next/image' // 添加这行导入

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

  // 手动刷新函数
  const handleRefresh = async () => {
    setError(null)
    setLoading(true)
    try {
      await readClipboard()
    } catch (err) {
      console.error('刷新剪贴板失败:', err)
      setError('刷新剪贴板失败')
    } finally {
      setLoading(false)
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
    }
  }

  // 检查剪贴板权限
  const checkClipboardPermission = async () => {
    try {
      setLoading(true)
      
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
    } finally {
      setLoading(false)
    }
  }

  // 初始化效果
  useEffect(() => {
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

  // 清空历史记录
  const clearHistory = () => {
    setClipboardItems([])
    localStorage.removeItem('clipboardHistory')
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">剪藏页</h1>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={loading}>
            刷新剪贴板
          </Button>
          <Button variant="outline" onClick={clearHistory}>
            清空历史
          </Button>
          <Button variant="outline" asChild>
            <Link href="/protected">返回首页</Link>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-10">加载中...</div>
      ) : clipboardItems.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          暂无剪贴板历史记录
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clipboardItems.map(item => (
            <ClipboardCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// 剪贴板内容卡片组件
function ClipboardCard({ item }: { item: ClipboardItem }) {
  // 格式化时间
  const formattedTime = new Date(item.timestamp).toLocaleString()
  
  // 搜索功能
  const handleSearch = () => {
    if (item.type === 'text') {
      window.open(`https://www.bing.com/search?q=${encodeURIComponent(item.content)}`, '_blank')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center text-base">
          <span>{item.type === 'text' ? '文本' : '图片'}</span>
          <span className="text-xs text-muted-foreground">{formattedTime}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-40 overflow-auto break-words">
          {item.type === 'text' && item.content}
          {item.type === 'image' && (
            <Image 
              src={item.content} 
              alt="剪贴板图片" 
              width={500}
              height={300}
              className="max-w-full h-auto object-contain"
              onError={() => {
                // 处理错误 (删除未使用的 e 参数)
              }}
            />
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {item.type === 'text' && (
          <Button size="sm" variant="outline" onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}