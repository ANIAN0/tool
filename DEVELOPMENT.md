# 开发规范

## 项目架构

### 目录结构
```
my-app/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (tools)/                # 工具页面组
│   │   │   ├── layout.tsx
│   │   │   └── [toolType]/
│   │   │       └── [toolId]/
│   │   │           ├── page.tsx
│   │   │           └── loading.tsx
│   │   ├── api/tools/[toolId]/     # API路由
│   │   │   └── route.ts
│   │   ├── docs/api/[toolId]/      # API文档页
│   │   │   └── page.tsx
│   │   ├── welcome/                # 首页
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css
│   │
│   ├── features/                   # 功能模块
│   │   ├── registry.ts             # 工具注册表
│   │   └── {tool-name}/
│   │       ├── index.ts            # 工具元数据
│   │       ├── components/
│   │       │   └── Main.tsx        # 主组件
│   │       └── lib/
│   │           └── api.ts          # API实现（可选）
│   │
│   ├── components/                 # 全局组件
│   │   ├── ToolCard.tsx
│   │   └── ToolLoading.tsx
│   │
│   └── lib/                        # 工具库
│       └── types.ts
│
├── scripts/
│   ├── generate-tool.js
│   └── update-registry.ts
│
├── next.config.ts
├── vercel.json
└── package.json
```

---

## 开发流程

### 1. 创建新工具

```bash
# 使用脚本快速创建
npm run new:tool

# 按提示输入：
# - 工具ID (kebab-case，如: json-formatter)
# - 工具名称 (如: JSON格式化)
# - 分类 (public-tools/private-tools)
# - 是否需要API (y/n)

# 更新注册表
npm run build:registry
```

### 2. 开发工具组件

在 `src/features/{tool-id}/components/Main.tsx` 中实现功能：

```typescript
'use client';

export default function Main() {
  // 实现工具的UI和逻辑
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">工具名称</h1>
      {/* 工具内容 */}
    </div>
  );
}
```

**注意事项：**
- 必须添加 `'use client'` 指令（客户端组件）
- 组件名必须是 `Main` 且为默认导出
- 不接收任何 props

### 3. 开发API（可选）

在 `src/features/{tool-id}/lib/api.ts` 中实现API：

```typescript
import { NextRequest } from 'next/server';

// 操作函数名对应 ?op=操作名
export async function operation1(request: NextRequest) {
  const data = await request.json();
  
  // 处理逻辑
  
  return Response.json({ result: 'success' });
}

export async function operation2(request: NextRequest) {
  // 其他操作
}
```

**注意事项：**
- 导出的函数名对应API的操作参数 `?op=函数名`
- 函数接收 `NextRequest` 参数
- 必须返回 `Response` 对象

### 4. 更新工具元数据

在 `src/features/{tool-id}/index.ts` 中配置：

```typescript
import type { ToolModule } from '@/lib/types';
import MainComponent from './components/Main';

export const metadata: ToolModule = {
  id: 'tool-id',
  name: '工具名称',
  description: '工具描述',
  type: 'public-tools', // 或 'private-tools'
  icon: '🔧',
  tags: ['标签1', '标签2'],
  isActive: true,
  apiPrefix: '/api/tools/tool-id', // 如果有API
  docs: {
    enabled: true, // 是否启用API文档
  },
};

export default MainComponent;
```

---

## 代码规范

### UI设计要求

### **1. 整体布局规范**
- **容器结构**：`container mx-auto max-w-7xl` + 响应式内边距
- **背景设计**：渐变背景 `bg-gradient-to-b from-background to-muted/20`
- **间距体系**：大区块 `space-y-16`，中等 `mb-8`，小元素 `gap-3/4/5`
- **响应式**：移动优先，px-4/sm:px-6/lg:px-8

### **2. Hero Section 设计**
- 居中布局 + 大图标容器（`w-16 h-16 rounded-2xl`）
- 主标题：`text-4xl sm:text-5xl font-bold`
- 副标题：`text-lg text-muted-foreground`
- 统计标签：`rounded-full bg-muted`

### **3. 区块标题规范**
- 图标容器：`w-10 h-10 rounded-lg bg-primary/5`
- 标题：`text-2xl font-semibold`
- 副标题：`text-sm text-muted-foreground mt-0.5`
- 颜色分配：主要功能用 `primary`，特殊功能用 `amber`

### **4. 网格与卡片布局**
- 响应式网格：`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- 间距：`gap-4 sm:gap-5`
- 优先上下布局，避免左右分栏
- 空状态：虚线边框 + 大图标 + 友好文案

### **5. 图标使用规范**
- **来源**：必须使用 `lucide-react`，禁用 emoji
- **尺寸**：Hero `w-12/16`，标题 `w-5`，标签 `w-3.5`，卡片 `w-4`
- **容器**：使用半透明背景（`/5` 或 `/10`）

### **6. 颜色与主题**
- **语义化颜色**：`text-foreground`、`text-muted-foreground`、`bg-muted`
- **透明度层级**：5%（淡）→ 10% → 20% → 30% → 40/60%
- **暗色模式**：使用 `dark:` 前缀适配

### **7. 文字排版**
- H1：`text-4xl sm:text-5xl font-bold tracking-tight`
- H2：`text-2xl font-semibold`
- 描述：`text-sm/lg text-muted-foreground`
- 提示：`text-xs text-muted-foreground`

### **8. 圆角与边框**
- 大容器：`rounded-xl`
- 中型：`rounded-lg`
- 标签：`rounded-full`
- 虚线边框：`border-2 border-dashed`

### **9. Footer 设计**
- 顶部大间距：`mt-24 pt-12 border-t`
- 居中友好文案：`text-sm text-muted-foreground`
- 使用中文标点（·）分隔

---

## 🎯 设计原则

1. **简洁优雅**：参考 shadcn 和 Figma 风格，避免过度装饰
2. **语义化**：使用 Tailwind 的语义化颜色变量
3. **响应式优先**：移动端单列 → 平板双列 → 桌面三列
4. **视觉层次清晰**：通过间距、字号、颜色建立层级
5. **一致性**：图标、圆角、间距保持统一标准


### TypeScript规范
- 严格模式开启
- 所有类型必须明确定义
- 优先使用接口而非类型别名（用于对象）
- 导出的组件和函数必须有类型注解

### 组件规范
- 客户端组件：必须添加 `'use client'` 指令
- 服务端组件：默认，无需添加指令
- 文件命名：PascalCase（如 `ToolCard.tsx`）
- 组件名称：与文件名一致

### API规范
- 路径：`/api/tools/{tool-id}?op={operation}`
- 请求方法：GET / POST / PUT / DELETE
- 响应格式：JSON 或二进制数据
- 错误处理：统一返回 `{ error: string }` 格式

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问应用
# http://localhost:3000
```

---

## 部署

### Vercel部署

```bash
# 本地构建测试
vercel build

# 部署到生产环境
vercel --prod
```

**注意事项：**
- 自动从 Git 仓库部署
- 无需配置环境变量
- 支持自动构建和CDN加速

---

## 访问路径规范

- 首页/欢迎页: `/` 或 `/welcome`
- 公共工具页: `/public-tools/{tool-id}`
- 私有工具页: `/private-tools/{tool-id}`
- API接口: `/api/tools/{tool-id}?op={operation}`
- API文档: `/docs/api/{tool-id}`
