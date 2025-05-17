"use client"

import { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { use } from 'react'

interface StaticPage {
  id: number
  title: string
  content: string
  created_at: string
}

export default function PageView({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [pageData, setPageData] = useState<StaticPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // 处理iframe内容加载
  const loadIframeContent = (content: string) => {
    console.log('开始加载iframe内容');
    if (!iframeRef.current) {
      console.error('iframe引用不存在');
      return;
    }

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) {
      console.error('无法访问iframe文档');
      setError('无法加载页面内容');
      setLoading(false);
      return;
    }

    try {
      // 写入内容
      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();
      console.log('iframe内容写入完成');

      // 监听iframe加载完成
      iframe.onload = () => {
        console.log('iframe onload事件触发');
        // 确保所有脚本都执行完成
        const scripts = iframeDoc.getElementsByTagName('script');
        let loadedScripts = 0;
        
        for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i];
          if (script.src) {
            // 外部脚本
            const newScript = iframeDoc.createElement('script');
            newScript.src = script.src;
            newScript.async = true;
            newScript.onload = () => {
              loadedScripts++;
              if (loadedScripts === scripts.length) {
                setLoading(false);
              }
            };
            newScript.onerror = () => {
              console.error('脚本加载失败:', script.src);
              loadedScripts++;
              if (loadedScripts === scripts.length) {
                setLoading(false);
              }
            };
            iframeDoc.body.appendChild(newScript);
          } else {
            // 内联脚本
            try {
              eval(script.textContent || '');
              loadedScripts++;
            } catch (err) {
              console.error('执行内联脚本失败:', err);
              loadedScripts++;
            }
          }
        }

        // 如果没有脚本，直接完成加载
        if (scripts.length === 0) {
          setLoading(false);
        }
      };

      // 监听iframe加载错误
      iframe.onerror = (error) => {
        console.error('iframe加载错误:', error);
        setError('页面加载失败');
        setLoading(false);
      };

      // 设置超时检查
      setTimeout(() => {
        if (loading) {
          console.log('iframe加载超时，强制完成');
          setLoading(false);
        }
      }, 10000);

    } catch (err) {
      console.error('加载iframe内容时出错:', err);
      setError('页面加载失败');
      setLoading(false);
    }
  }

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const response = await fetch(`/api/external/pages/public/${resolvedParams.id}`)
        if (!response.ok) throw new Error('获取页面数据失败')
        
        const data = await response.json()
        setPageData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取数据失败')
      } finally {
        setLoading(false)
      }
    }

    fetchPageData()
  }, [resolvedParams.id])

  // 监听pageData变化，加载iframe内容
  useEffect(() => {
    if (pageData?.content && iframeRef.current) {
      console.log('检测到pageData和iframe都存在，开始加载内容');
      loadIframeContent(pageData.content);
    }
  }, [pageData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-4 text-red-500 bg-red-50 rounded-md">
          {error || '页面不存在'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 bg-muted border-b">
        <h1 className="text-2xl font-semibold">{pageData.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          创建时间: {new Date(pageData.created_at).toLocaleString()}
        </p>
      </div>
      <div className="w-full h-[calc(100vh-80px)]">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms"
          title="preview"
        />
      </div>
    </div>
  )
}