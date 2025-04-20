"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Code } from "@/app/debug/components/code"
import TextLoading from "@/components/TextLoading"
import ImageLoading from "@/components/ImageLoading"

export default function LoadingSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>动画加载效果</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 功能演示区域 */}
        <div className="space-y-8">
          <div className="p-6 bg-muted rounded-lg flex flex-col items-center gap-8">
            <TextLoading className="mb-12" />
            <ImageLoading 
              src="https://img.picgo.net/2025/04/20/2025-04-20T11_44_20.582Z-844951f3706495262ac60f.gif" 
              className="w-48 h-48" 
            />
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">使用说明</h3>
            <div className="space-y-6">
              {/* 文字加载组件 */}
              <div>
                <h4 className="text-sm font-medium mb-2">文字加载组件</h4>
                <div className="bg-card p-4 rounded-md">
                  <Code className="text-xs">
{`import TextLoading from "@/components/TextLoading"

// 默认用法
<TextLoading />  // 显示 "HELLO WORLD"

// 自定义文本
<TextLoading text="加载中..." />

// 自定义样式
<TextLoading 
  text="请稍候" 
  className="text-2xl text-blue-600" 
/>`}
                  </Code>
                </div>
              </div>

              {/* 图片加载组件 */}
              <div>
                <h4 className="text-sm font-medium mb-2">图片加载组件</h4>
                <div className="bg-card p-4 rounded-md">
                  <Code className="text-xs">
{`import ImageLoading from "@/components/ImageLoading"

// 基本用法
<ImageLoading src="your-image-url.jpg" />

// 自定义尺寸
<ImageLoading 
  src="your-image-url.jpg"
  className="w-48 h-48"
/>`}
                  </Code>
                </div>
              </div>

              {/* 组件属性说明 */}
              <div>
                <h4 className="text-sm font-medium mb-2">组件属性</h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>TextLoading 组件：
                    <ul className="list-circle list-inside ml-4">
                      <li><code>text</code>: 显示的文本内容（可选，默认为 "HELLO WORLD"）</li>
                      <li><code>className</code>: 自定义样式类名（可选）</li>
                    </ul>
                  </li>
                  <li>ImageLoading 组件：
                    <ul className="list-circle list-inside ml-4">
                      <li><code>src</code>: 图片地址（必填）</li>
                      <li><code>className</code>: 自定义样式类名（可选）</li>
                    </ul>
                  </li>
                </ul>
              </div>

              {/* 动画特性 */}
              <div>
                <h4 className="text-sm font-medium mb-2">动画特性</h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>文字加载：
                    <ul className="list-circle list-inside ml-4">
                      <li>字母垂直弹跳动画</li>
                      <li>旋转过渡效果</li>
                      <li>错开的延迟动画</li>
                    </ul>
                  </li>
                  <li>图片加载：
                    <ul className="list-circle list-inside ml-4">
                      <li>轻微的左右晃动</li>
                      <li>轻微的上下浮动</li>
                      <li>微小的旋转效果</li>
                    </ul>
                  </li>
                  <li>所有动画均循环播放</li>
                </ul>
              </div>

              {/* 实现细节 */}
              <div>
                <h4 className="text-sm font-medium mb-2">实现细节</h4>
                <div className="bg-card p-4 rounded-md space-y-4">
                  <div>
                    <p className="text-sm mb-2">文字动画配置：</p>
                    <Code className="text-xs">
{`animate(elements, {
  y: [
    { to: '-2.75rem', ease: 'outExpo', duration: 600 },
    { to: 0, ease: 'outBounce', duration: 800, delay: 100 }
  ],
  rotate: {
    from: '-1turn',
    delay: 0
  },
  delay: (_, i) => i * 50,
  ease: 'inOutCirc',
  loop: true,
  loopDelay: 1000
});`}
                    </Code>
                  </div>
                  <div>
                    <p className="text-sm mb-2">图片动画配置：</p>
                    <Code className="text-xs">
{`style={{
  transform: \`
    translateX(\${Math.sin(rotation * 0.1) * 5}px)
    translateY(\${Math.cos(rotation * 0.15) * 3}px)
    rotate(\${Math.sin(rotation * 0.05) * 2}deg)
  \`,
  transition: 'transform 0.3s ease-in-out'
}}`}
                    </Code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

