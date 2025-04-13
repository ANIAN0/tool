import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Code } from "@/app/debug/components/code"

export default function LayoutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>标准页面布局</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 布局预览 */}
          <div>
            <h3 className="text-lg font-medium mb-2">布局预览</h3>
            <div className="border rounded-md p-4">
              <div className="h-12 bg-primary/20 rounded-md mb-4 flex items-center justify-center">
                Header 组件
              </div>
              <div className="flex gap-4">
                <div className="w-1/4 h-40 bg-primary/10 rounded-md flex items-center justify-center">
                  侧边栏
                </div>
                <div className="w-3/4 h-40 bg-primary/5 rounded-md flex items-center justify-center">
                  主内容区
                </div>
              </div>
              <div className="h-12 bg-primary/20 rounded-md mt-4 flex items-center justify-center">
                Footer 组件
              </div>
            </div>
          </div>
          
          {/* 代码示例 */}
          <div>
            <h3 className="text-lg font-medium mb-2">基础布局代码</h3>
            <div className="bg-card p-4 rounded-md">
              <Code className="text-xs">
{`<div className="min-h-screen flex flex-col bg-background">
  {/* Header */}
  <Header email={user?.email} isAdmin={isAdmin} />
  
  {/* 主内容区 */}
  <main className="flex-1 py-8">
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex gap-4">
        {/* 侧边栏 */}
        <aside className="w-1/4">
          {/* 侧边栏内容 */}
        </aside>
        
        {/* 主要内容 */}
        <div className="w-3/4">
          {/* 页面主要内容 */}
        </div>
      </div>
    </div>
  </main>

  {/* Footer */}
  <footer className="py-6 border-t">
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 页脚内容 */}
    </div>
  </footer>
</div>`}
              </Code>
            </div>
          </div>
          
          {/* 实现说明 */}
          <div>
            <h3 className="text-lg font-medium mb-2">实现说明</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>使用 <code>min-h-screen flex flex-col</code> 确保页面至少占满整个视口</li>
              <li>Header 组件固定在顶部，统一处理用户状态</li>
              <li>主内容区使用 <code>flex-1</code> 自动填充剩余空间</li>
              <li>使用 <code>container</code> 和 <code>max-w-7xl</code> 控制内容最大宽度</li>
              <li>使用响应式类 <code>px-4 sm:px-6 lg:px-8</code> 在不同屏幕尺寸下调整内边距</li>
              <li>使用语义化标签 <code>main</code>, <code>aside</code>, <code>footer</code> 增强可访问性</li>
            </ol>
          </div>

          {/* 响应式处理 */}
          <div>
            <h3 className="text-lg font-medium mb-2">响应式布局处理</h3>
            <div className="bg-card p-4 rounded-md">
              <Code className="text-xs">
{`// 移动端布局调整
<div className="flex flex-col md:flex-row gap-4">
  {/* 侧边栏在移动端全宽显示 */}
  <aside className="w-full md:w-1/4">
    {/* 侧边栏内容 */}
  </aside>
  
  {/* 主内容区在移动端全宽显示 */}
  <div className="w-full md:w-3/4">
    {/* 页面主要内容 */}
  </div>
</div>`}
              </Code>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}