"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function InteractionSection() {
  const [isCardHovered, setIsCardHovered] = useState(false)
  const [isButtonHovered, setIsButtonHovered] = useState(false)

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2">
        {/* 卡片组件 */}
        <Card 
          className={cn(
            "transition-colors duration-200",
            isCardHovered ? "bg-accent" : ""
          )}
          onMouseEnter={() => setIsCardHovered(true)}
          onMouseLeave={() => setIsCardHovered(false)}
        >
          <CardHeader>
            <CardTitle>悬停效果卡片</CardTitle>
          </CardHeader>
          <CardContent>
            <p>将鼠标移到这个卡片上，背景颜色会改变。</p>
            <p className="text-muted-foreground mt-2">
              当前状态: {isCardHovered ? "悬停中" : "未悬停"}
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              使用 useState 跟踪悬停状态，并使用 cn 工具函数有条件地应用样式
            </p>
          </CardFooter>
        </Card>

        {/* 按钮组件 */}
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">按钮悬停效果</h2>
          <Button 
            className={cn(
              "transition-colors duration-200",
              isButtonHovered ? "bg-accent" : ""
            )}
            onMouseEnter={() => setIsButtonHovered(true)}
            onMouseLeave={() => setIsButtonHovered(false)}
            size="lg"
          >
            悬停测试按钮
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            当前状态: {isButtonHovered ? "悬停中" : "未悬停"}
          </p>
        </div>
      </div>

      <div className="mt-6 p-6 border rounded-lg bg-muted/20">
        <h2 className="text-xl font-semibold mb-4">实现说明</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>使用 <code>useState</code> 钩子跟踪元素的悬停状态</li>
          <li>通过 <code>onMouseEnter</code> 和 <code>onMouseLeave</code> 事件处理悬停状态变化</li>
          <li>使用 <code>cn</code> 工具函数有条件地应用 CSS 类</li>
          <li>添加 <code>transition-colors</code> 和 <code>duration-200</code> 类实现平滑过渡</li>
          <li>当悬停时应用 <code>bg-accent</code> 类改变背景颜色</li>
        </ol>
      </div>
    </>
  )
}
