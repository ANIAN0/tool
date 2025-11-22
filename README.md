# 项目基础信息
- Next.js 16.0.3
- 部署在 Vercel
- 开发在 Windows

# 项目基础设计

# Next.js 16.0.3 功能工具箱 - 无权限版完整方案

## 一、项目目录结构（纯净版）

```
my-app/
├── src/
│   ├── app/
│   │   ├── (tools)/
│   │   │   ├── layout.tsx
│   │   │   └── [toolType]/
│   │   │       └── [toolId]/
│   │   │           ├── page.tsx       # 动态功能页
│   │   │           └── loading.tsx
│   │   ├── api/
│   │   │   └── tools/
│   │   │       └── [toolId]/
│   │   │           └── route.ts       # API聚合入口
│   │   ├── docs/
│   │   │   └── api/
│   │   │       └── [toolId]/page.tsx  # 静态文档页
│   │   ├── welcome/
│   │   │   └── page.tsx               # 功能列表页
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css
│   │
│   ├── features/                      # 功能模块
│   │   ├── registry.ts                # 显式注册表
│   │   ├── calculator/
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   │   └── Main.tsx
│   │   │   └── lib/
│   │   │       └── api.ts
│   │   └── url-encoder/
│   │       └── ...（同上结构）
│   │
│   ├── components/                    # 全局组件
│   │   ├── ToolCard.tsx
│   │   └── ToolLoading.tsx
│   │
│   └── lib/                           # 工具库
│       └── types.ts                   # 仅保留基础类型
│
├── public/
│   └── icons/
│
├── scripts/
│   ├── generate-tool.js
│   └── update-registry.ts
│
├── next.config.ts
├── vercel.json
├── package.json
└── tsconfig.json
```

---

## 二、核心实现代码（纯净版）

### 1. 模块注册表（`src/features/registry.ts`）

```typescript
// src/features/registry.ts
import type { ToolModule } from '@/lib/types';

export const toolMetadataIndex: Record<string, ToolModule> = {
  'calculator': {
    id: 'calculator',
    name: '科学计算器',
    description: '支持复杂数学运算',
    type: 'public-tools',
    icon: '🧮',
    tags: ['数学', '计算'],
    isActive: true,
    apiPrefix: '/api/tools/calculator',
    docs: { enabled: true },
  },
  'url-encoder': {
    id: 'url-encoder',
    name: 'URL编码解码',
    description: 'URL百分比编码转换',
    type: 'public-tools',
    icon: '🔗',
    tags: ['编码', 'URL'],
    isActive: true,
    apiPrefix: '/api/tools/url-encoder',
    docs: { enabled: true },
  },
  'json-formatter': {
    id: 'json-formatter',
    name: 'JSON格式化',
    description: '美化和验证JSON数据',
    type: 'public-tools',
    icon: '📄',
    tags: ['JSON', '格式化'],
    isActive: true,
    apiPrefix: '/api/tools/json-formatter',
    docs: { enabled: true },
  },
} as const;

export const toolComponentLoader = {
  'calculator': () => import('./calculator'),
  'url-encoder': () => import('./url-encoder'),
  'json-formatter': () => import('./json-formatter'),
} as const;

export type ToolId = keyof typeof toolComponentLoader;

export function getToolMetadata(toolId: string): ToolModule | null {
  return toolMetadataIndex[toolId] ?? null;
}

export function getAllTools(): ToolModule[] {
  return Object.values(toolMetadataIndex);
}
```

### 2. 工具路由页（`src/app/(tools)/[toolType]/[toolId]/page.tsx`）

```typescript
// src/app/(tools)/[toolType]/[toolId]/page.tsx
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { toolComponentLoader, getToolMetadata } from '@/features/registry';
import { ToolLoading } from '@/components/ToolLoading';
import type { ToolType } from '@/lib/types';

interface Props {
  params: Promise<{ toolType: ToolType; toolId: string }>;
}

export const revalidate = 3600;

export async function generateStaticParams() {
  const tools = getAllTools();
  return tools.map(tool => ({
    toolType: tool.type,
    toolId: tool.id,
  }));
}

export async function generateMetadata({ params }: Props) {
  const { toolId } = await params;
  const tool = getToolMetadata(toolId);
  return tool ? { title: `${tool.name} - 工具箱` } : { title: '工具未找到' };
}

export default async function ToolPage({ params }: Props) {
  const { toolType, toolId } = await params;
  const tool = getToolMetadata(toolId);

  // 仅验证工具是否存在
  if (!tool || tool.type !== toolType) {
    notFound();
  }

  const loader = toolComponentLoader[toolId as keyof typeof toolComponentLoader];
  if (!loader) {
    notFound();
  }

  const { default: ToolComponent } = await loader();

  return (
    <div className="tool-container">
      <Suspense fallback={<ToolLoading name={tool.name} />}>
        <ToolComponent tool={tool} />
      </Suspense>
    </div>
  );
}
```

### 3. API聚合入口（`src/app/api/tools/[toolId]/route.ts`）

```typescript
// src/app/api/tools/[toolId]/route.ts
import { notFound } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { getToolMetadata } from '@/features/registry';

export const runtime = 'nodejs';

export async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;
  const tool = getToolMetadata(toolId);

  if (!tool || !tool.isActive) {
    notFound();
  }

  const url = new URL(request.url);
  const operation = url.searchParams.get('op') || 'default';

  try {
    const apiModule = await import(`@/features/${toolId}/lib/api`);
    const handler = apiModule[operation];

    if (typeof handler !== 'function') {
      return Response.json(
        { error: `操作 ${operation} 不存在` },
        { status: 400 }
      );
    }

    return handler(request);
  } catch (error) {
    console.error(`API加载失败: ${toolId}`, error);
    return Response.json(
      { error: '工具服务不可用' },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
```

### 4. 欢迎页（`src/app/welcome/page.tsx`）

```typescript
// src/app/welcome/page.tsx
import { getAllTools } from '@/features/registry';
import { ToolCard } from '@/components/ToolCard';

export const revalidate = 3600;

export default function WelcomePage() {
  const tools = getAllTools();
  const publicTools = tools.filter(t => t.type === 'public-tools');
  const privateTools = tools.filter(t => t.type === 'private-tools');

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      <h1 className="text-4xl font-bold mb-2">🛠️ 我的工具箱</h1>
      <p className="text-gray-600 mb-8">收集和部署有用的工具</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 公共工具 */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <span className="mr-3">🌐</span> 公共工具
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {publicTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        {/* 私有工具 */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <span className="mr-3">🔒</span> 私有工具
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {privateTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-16 text-center text-gray-500 text-sm">
        <p>点击工具卡片开始使用 | 共 {tools.length} 个工具</p>
      </footer>
    </div>
  );
}
```

### 5. 工具卡片组件（`src/components/ToolCard.tsx`）

```typescript
// src/components/ToolCard.tsx
import Link from 'next/link';
import type { ToolModule } from '@/lib/types';

interface ToolCardProps {
  tool: ToolModule;
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link href={`/${tool.type}/${tool.id}`}>
      <div className="group border rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
              {tool.name}
            </h3>
            <p className="text-sm text-gray-600 mt-2 min-h-[40px]">
              {tool.description}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {tool.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-4 text-2xl">
            {tool.icon || (tool.type === 'private-tools' ? '🔒' : '🌐')}
          </div>
        </div>
      </div>
    </Link>
  );
}
```

### 6. 加载组件（`src/components/ToolLoading.tsx`）

```typescript
// src/components/ToolLoading.tsx
interface Props {
  name: string;
}

export function ToolLoading({ name }: Props) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">正在加载 {name}...</p>
      </div>
    </div>
  );
}
```

---

## 三、配置文件

### `next.config.ts`

```typescript
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  swcMinify: true,
  poweredByHeader: false,
  
  images: {
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
  },

  experimental: {
    outputFileTracingRoot: path.join(__dirname, 'src'),
    outputFileTracingIncludes: {
      '/api/tools/[toolId]': ['./src/features/**/*'],
      '/public-tools/[toolId]': ['./src/features/**/*'],
      '/private-tools/[toolId]': ['./src/features/**/*'],
    },
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;
```

### `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run prebuild && next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "functions": {
    "src/app/api/tools/[toolId]/route.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": "src",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `package.json`

```json
{
  "name": "my-toolkit",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "prebuild": "npm run build:registry",
    "new:tool": "node scripts/generate-tool.js",
    "build:registry": "ts-node scripts/update-registry.ts"
  },
  "dependencies": {
    "next": "16.0.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "16.0.3",
    "ts-node": "^10.9.2",
    "typescript": "^5"
  }
}
```

---

## 四、类型定义（`src/lib/types.ts`）

```typescript
export type ToolType = 'public-tools' | 'private-tools';

export interface ToolModule {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  icon?: string;
  tags: string[];
  isActive: boolean;
  apiPrefix?: string;
  docs: {
    enabled: boolean;
  };
}
```

---

## 五、开发脚本

### `scripts/generate-tool.js`

```javascript
#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const toolId = await prompt('工具ID (kebab-case): ');
  const name = await prompt('工具名称: ');
  const type = await prompt('工具分类 (public-tools/private-tools): ');
  const needsApi = await prompt('需要API吗? (y/n): ') === 'y';

  const toolDir = path.join(__dirname, '../src/features', toolId);
  await fs.mkdir(toolDir, { recursive: true });
  await fs.mkdir(path.join(toolDir, 'components'), { recursive: true });
  await fs.mkdir(path.join(toolDir, 'lib'), { recursive: true });

  await fs.writeFile(
    path.join(toolDir, 'index.ts'),
    `import type { ToolModule } from '@/lib/types';
import MainComponent from './components/Main';

export const metadata = {
  id: '${toolId}',
  name: '${name}',
  description: '请添加功能描述',
  type: '${type}',
  icon: '🔧',
  tags: [],
  isActive: true,
  apiPrefix: ${needsApi ? `'/api/tools/${toolId}'` : 'undefined'},
  docs: { enabled: ${needsApi ? 'true' : 'false'} },
} satisfies ToolModule;

export default MainComponent;
`
  );

  await fs.writeFile(
    path.join(toolDir, 'components/Main.tsx'),
    `export default function Main() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">${name}</h1>
      <p className="mt-4 text-gray-600">功能开发中...</p>
      <div className="mt-8 p-4 bg-gray-50 rounded">
        <p className="text-sm text-gray-500">
          提示：在 src/features/${toolId}/components/Main.tsx 中实现功能
        </p>
      </div>
    </div>
  );
}
`
  );

  if (needsApi) {
    await fs.writeFile(
      path.join(toolDir, 'lib/api.ts'),
      `export async function default(request: Request) {
  const data = await request.json().catch(() => ({}));
  return Response.json({ 
    message: '${name} API 测试成功',
    received: data 
  });
}
`
    );
  }

  console.log(`✅ 工具 ${toolId} 创建成功！`);
  console.log(`📌 下一步：`);
  console.log(`   1. 将 '${toolId}' 添加到 src/features/registry.ts`);
  console.log(`   2. 执行: npm run build:registry`);
  console.log(`   3. 访问: /${type}/${toolId}`);
}

main().catch(console.error).finally(() => rl.close());
```

### `scripts/update-registry.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';

async function updateRegistry() {
  const featuresDir = path.join(process.cwd(), 'src/features');
  const entries = await fs.readdir(featuresDir, { withFileTypes: true });
  
  const tools = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'registry.ts')
    .map(dir => dir.name);

  const registryContent = `// 自动生成的注册表，不要手动编辑
import type { ToolModule } from '@/lib/types';

${tools.map(tool => `import { metadata as ${tool}Meta } from './${tool}';`).join('\n')}
${tools.map(tool => `import ${tool}Component from './${tool}';`).join('\n')}

export const toolMetadataIndex: Record<string, ToolModule> = {
${tools.map(tool => `  '${tool}': ${tool}Meta,`).join('\n')}
};

export const toolComponentLoader = {
${tools.map(tool => `  '${tool}': () => import('./${tool}'),`).join('\n')}
} as const;

export type ToolId = keyof typeof toolComponentLoader;

export function getToolMetadata(toolId: string): ToolModule | null {
  return toolMetadataIndex[toolId] ?? null;
}

export function getAllTools(): ToolModule[] {
  return Object.values(toolMetadataIndex);
}
`;

  await fs.writeFile(path.join(featuresDir, 'registry.ts'), registryContent);
  console.log('✅ 注册表已更新');
}

updateRegistry().catch(console.error);
```

---

## 六、使用说明

### 1. 创建新工具

```bash
npm run new:tool
# 输入: tool-id, 名称, public-tools/private-tools, 是否需要API

# 然后执行
npm run build:registry

# 访问: http://localhost:3000/public-tools/tool-id
```

### 2. 工具开发示例

```typescript
// src/features/json-formatter/components/Main.tsx
import { useState } from 'react';

export default function Main() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const format = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setOutput('❌ 无效的JSON');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">JSON格式化工具</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <textarea
          className="w-full h-64 p-4 border rounded"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入JSON..."
        />
        <pre className="w-full h-64 p-4 border rounded bg-gray-50 overflow-auto">
          {output}
        </pre>
      </div>
      <button
        onClick={format}
        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        格式化
      </button>
    </div>
  );
}
```

### 3. API开发示例

```typescript
// src/features/calculator/lib/api.ts
export async function compute(request: Request) {
  const { expression } = await request.json();
  
  try {
    // 注意：实际使用应添加安全验证
    const result = Function('"use strict"; return (' + expression + ')')();
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: '计算失败' }, { status: 400 });
  }
}
```

### 4. 部署到Vercel

```bash
# 1. 推送到GitHub
git add .
git commit -m "feat: 初始化无权限工具箱"
git push origin main

# 2. 在Vercel Dashboard导入仓库
# 3. 无需配置环境变量
# 4. 自动部署
```


## 六、快速开始（最终版）

```bash
# 1. 克隆/创建项目（已存在 my-app/src/app）
cd my-app

# 2. 安装依赖
npm install jose zod swagger-jsdoc @types/swagger-jsdoc

# 3. 创建目录结构
mkdir -p src/features src/components src/lib src/config scripts

# 4. 初始化注册表
touch src/features/registry.ts

# 5. 创建第一个工具
npm run new:tool
# 按提示输入工具信息

# 6. 更新注册表
npm run build:registry

# 7. 启动开发
npm run dev

# 8. 部署到Vercel
vercel --prod
```


# 功能清单

## 已完成功能
1. ✅ **图片拼接工具** (image-merger)
   - 支持多张图片上传
   - 按800px宽度自动缩放
   - 从上到下拼接成一张图片
   - 支持PNG格式输出
   - 提供功能页面和API接口
   - 路径: `/public-tools/image-merger`
   - API: `/api/tools/image-merger?op=merge`

## 待添加功能
（待规划）

# UI要求

## 设计风格
- 简洁现代的UI设计
- 使用 Tailwind CSS 进行样式开发
- 响应式布局，支持移动端和桌面端
- 清晰的视觉层次和交互反馈

## 通用组件
- ToolCard: 工具卡片展示
- ToolLoading: 加载状态提示
- 统一的导航栏和页面布局

---

# 快速开始

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 访问应用
# 浏览器打开 http://localhost:3000
```

## 创建新工具

```bash
# 使用脚本快速创建
npm run new:tool

# 按提示输入：
# - 工具ID (kebab-case)
# - 工具名称
# - 分类 (public-tools/private-tools)
# - 是否需要API

# 更新注册表
npm run build:registry
```

## 访问路径

- 首页/欢迎页: `/` 或 `/welcome`
- 公共工具: `/public-tools/{tool-id}`
- 私有工具: `/private-tools/{tool-id}`
- API接口: `/api/tools/{tool-id}?op={operation}`

## 示例：图片拼接工具

- 页面访问: http://localhost:3000/public-tools/image-merger
- API调用:
  ```bash
  curl -X POST http://localhost:3000/api/tools/image-merger?op=merge \
    -F "image0=@/path/to/image1.jpg" \
    -F "image1=@/path/to/image2.jpg" \
    --output merged.png
  ```

# 上一步的改动

## 第一期改动（图片拼接工具）

### 1. 创建基础架构
- ✅ 创建 `src/lib/types.ts` - 定义核心类型
- ✅ 创建 `src/components/ToolCard.tsx` - 工具卡片组件
- ✅ 创建 `src/components/ToolLoading.tsx` - 加载组件
- ✅ 创建 `src/features/registry.ts` - 工具注册表

### 2. 创建路由系统
- ✅ 创建 `src/app/(tools)/layout.tsx` - 工具页面布局
- ✅ 创建 `src/app/(tools)/[toolType]/[toolId]/page.tsx` - 动态工具路由
- ✅ 创建 `src/app/(tools)/[toolType]/[toolId]/loading.tsx` - 加载状态
- ✅ 创建 `src/app/api/tools/[toolId]/route.ts` - API路由
- ✅ 创建 `src/app/welcome/page.tsx` - 欢迎页
- ✅ 创建 `src/app/not-found.tsx` - 404页面
- ✅ 修改 `src/app/page.tsx` - 重定向到欢迎页

### 3. 创建图片拼接工具
- ✅ 创建 `src/features/image-merger/index.ts` - 工具元数据
- ✅ 创建 `src/features/image-merger/components/Main.tsx` - 前端界面
  - 支持多图上传
  - 图片预览
  - 顺序调整（上移/下移）
  - 图片删除
  - 实时拼接
  - 结果下载
- ✅ 创建 `src/features/image-merger/lib/api.ts` - API实现
  - 使用 sharp 库处理图片
  - 800px 宽度缩放
  - PNG 格式输出

### 4. 开发工具脚本
- ✅ 创建 `scripts/generate-tool.js` - 快速创建新工具
- ✅ 创建 `scripts/update-registry.ts` - 自动更新注册表

### 5. 配置更新
- ✅ 更新 `package.json`
  - 添加 sharp 依赖
  - 添加 ts-node 开发依赖
  - 添加 npm 脚本（new:tool, build:registry）

# 本次需求
