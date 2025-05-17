"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Code } from "@/app/devpages/debug/components/code"

export default function ExtensionGuideSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Debug页面扩展指南</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          Debug页面采用模块化设计，可以方便地添加新的功能展示模块。以下是扩展Debug页面的标准流程：
        </p>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">1. 创建新的Section组件</h3>
            <div className="bg-card p-4 rounded-md">
              <Code className="text-xs">
{`// src/app/debug/components/sections/NewFeatureSection.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewFeatureSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>新功能展示</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 在这里实现新功能的展示内容 */}
        <div className="p-4 bg-muted rounded-md">
          <p>功能演示区域</p>
        </div>
        
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">实现说明</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>实现步骤 1</li>
            <li>实现步骤 2</li>
            <li>实现步骤 3</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}`}
              </Code>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">2. 在主页面中导入并添加到sections数组</h3>
            <div className="bg-card p-4 rounded-md">
              <Code className="text-xs">
{`// src/app/debug/page.tsx
import { FileTextIcon } from "lucide-react"
import NewFeatureSection from "./components/sections/NewFeatureSection"

// 在sections数组中添加新的部分
const sections = [
  // ... 现有部分
  {
    id: "new-feature",
    title: "新功能",
    icon: <FileTextIcon className="h-4 w-4" />,
    content: <NewFeatureSection />
  }
]`}
              </Code>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">扩展规范要点</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>每个功能模块应该是一个独立的组件，放在 <code>components/sections</code> 目录下</li>
              <li>组件名称应该以 <code>Section</code> 结尾，例如 <code>FormValidationSection</code></li>
              <li>每个模块应包含功能演示和实现说明两部分</li>
              <li>如果模块需要用户状态，应通过props从主页面传入</li>
              <li>使用一致的UI组件和样式，保持整体风格统一</li>
              <li>添加适当的注释，方便其他开发者理解</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">组件结构建议</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>使用 Card 组件作为最外层容器</li>
              <li>分为标题区（CardHeader）和内容区（CardContent）</li>
              <li>内容区包含功能演示和实现说明两个部分</li>
              <li>使用统一的间距和样式类</li>
              <li>保持代码整洁，遵循项目的代码风格指南</li>
            </ul>
          </div>

          {/* 新增：Tabs布局注意事项 */}
          <div>
            <h3 className="text-lg font-medium mb-2">Tabs布局注意事项</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>使用固定的 grid-cols-{`{n}`} 类名，而不是动态拼接</li>
              <li>示例：<code>className="grid grid-cols-5 mb-4"</code></li>
              <li>添加新的section时，需要相应更新 grid-cols 的数值</li>
              <li>避免使用模板字符串动态生成类名，如 <code>{`grid-cols-\${sections.length}`}</code></li>
              <li>原因：Tailwind 在构建时需要静态分析所有可能的类名</li>
            </ul>
            <div className="mt-4 bg-card p-4 rounded-md">
              <Code className="text-xs">
{`// 正确示例
<TabsList className="grid grid-cols-5 mb-4">
  {sections.map((section) => (
    <TabsTrigger key={section.id} value={section.id}>
      {section.title}
    </TabsTrigger>
  ))}
</TabsList>

// 错误示例 - 不要这样做
<TabsList className={\`grid grid-cols-\${sections.length} mb-4\`}>
  {/* ... */}
</TabsList>`}
              </Code>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}