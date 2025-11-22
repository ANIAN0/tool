# 项目基础信息
- Next.js 16.0.3
- 部署在 Vercel

# 项目基础设计

## 一、项目目录结构（含 `src` 目录）

```
my-app/
├── src/
│   ├── app/                           # App Router（位于src内）
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── middleware.ts          # Edge Runtime认证中间件
│   │   ├── (tools)/
│   │   │   ├── layout.tsx
│   │   │   ├── [toolType]/
│   │   │   │   └── [toolId]/
│   │   │   │       ├── page.tsx       # 动态功能页
│   │   │   │       └── loading.tsx
│   │   │   └── middleware.ts          # 工具路由专属中间件
│   │   ├── api/
│   │   │   └── tools/
│   │   │       └── [toolId]/
│   │   │           └── route.ts       # 聚合API入口
│   │   ├── docs/
│   │   │   └── api/
│   │   │       └── [toolId]/page.tsx  # 静态文档页
│   │   ├── welcome/
│   │   │   └── page.tsx               # 静态首页
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css
│   │
│   ├── features/                      # 功能模块（移至src）
│   │   ├── registry.ts                # 显式模块注册表
│   │   ├── calculator/
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   │   └── Main.tsx
│   │   │   └── lib/
│   │   │       ├── api.ts
│   │   │       └── types.ts
│   │   └── url-encoder/
│   │       └── ...（同上结构）
│   │
│   ├── components/                    # 全局组件（src内）
│   │   ├── common/
│   │   ├── layout/
│   │   └── ui/
│   │
│   ├── lib/                           # 工具库（src内）
│   │   ├── auth.ts
│   │   ├── types.ts
│   │   └── vercel.ts
│   │
│   └── config/
│       └── tools.config.ts            # 运行时配置
│
├── public/                            # 静态资源（根目录）
│   └── icons/
│
├── scripts/                           # 构建脚本（根目录）
│   ├── generate-tool.js
│   ├── update-registry.ts
│   └── validate-tools.ts
│
├── middleware.ts                      # 根中间件（项目根）
├── next.config.js
├── vercel.json
├── package.json
├── tsconfig.json
└── .env.local
```

**关键路径调整说明**：
- 所有源码（`app`、`features`、`components`、`lib`、`config`）统一放在 `src/` 目录下
- `public`、`scripts`、配置文件保留在根目录
- `middleware.ts` 保留在根目录（全局中间件），同时 `src/app/(tools)/middleware.ts` 作为路由级中间件
- `tsconfig.json` 中已配置 `"baseUrl": "src"` 和路径别名 `"@/*": ["./src/*"]`

---

## 二、核心代码路径修正

### 1. 模块注册表（`src/features/registry.ts`）

```typescript
// src/features/registry.ts
import type { ToolModule } from '@/lib/types';

export const toolMetadataIndex: Record<string, ToolModule> = {
  'calculator': {
    id: 'calculator',
    name: '科学计算器',
    type: 'public-tools',
    permissions: [],
    isActive: true,
    apiPrefix: '/api/tools/calculator',
    docs: { enabled: true },
  },
  // ... 更多工具
};

export const toolComponentLoader = {
  'calculator': () => import('./calculator'),
} as const;

export type ToolId = keyof typeof toolComponentLoader;
```

### 2. 路由页（`src/app/(tools)/[toolType]/[toolId]/page.tsx`）

```typescript
// src/app/(tools)/[toolType]/[toolId]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { toolComponentLoader, getToolMetadata } from '@/features/registry';
import type { ToolType } from '@/lib/types';
import { verifyToolAccess } from '@/lib/auth';

// 从 src/features 导入
// 从 src/lib 导入

export default async function ToolPage({ params }) {
  // ... 实现逻辑不变
}
```

### 3. API路由（`src/app/api/tools/[toolId]/route.ts`）

```typescript
// src/app/api/tools/[toolId]/route.ts
import { getToolMetadata } from '@/features/registry';
import type { NextRequest } from 'next/server';

export async function handler(request: NextRequest, { params }) {
  const { toolId } = await params;
  
  // 动态导入 src/features 下的模块
  const apiModule = await import(`@/features/${toolId}/lib/api`);
  
  // ... 其余逻辑
}
```

### 4. 中间件（`src/app/(tools)/middleware.ts`）

```typescript
// src/app/(tools)/middleware.ts
import { verifyToolAccessEdge } from '@/lib/auth';
import { getToolMetadata } from '@/features/registry';
// 从 src/ 路径导入

export async function middleware(req: NextRequest) {
  // ... Edge Runtime权限校验
}
```

### 5. 根中间件（`middleware.ts` 位于项目根）

```typescript
// middleware.ts（项目根）
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 全局中间件（如全局认证、CORS等）
export async function middleware(req: NextRequest) {
  // 确保 next.config.js 中 has: [{ type: 'host', value: 'your-domain.com' }]
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public-tools|private-tools).*)'],
};
```

---

## 三、配置文件路径修正

### `tsconfig.json`（路径别名配置）

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
    "baseUrl": "src",                    // 关键：设置为 src
    "paths": {
      "@/*": ["./src/*"],                // 所有路径相对于 src
      "@/features/*": ["./src/features/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/config/*": ["./src/config/*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `next.config.js`（保持根目录）

```typescript
// next.config.js（项目根）
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // TypeScript和ESLint在构建时自动处理
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  // 实验性特性
  experimental: {
    // 明确指定src目录
    outputFileTracingRoot: path.join(__dirname, 'src'),
    
    // 优化输出追踪
    outputFileTracingIncludes: {
      '/api/tools/[toolId]': ['./src/features/**/*'],
      '/public-tools/[toolId]': ['./src/features/**/*'],
      '/private-tools/[toolId]': ['./src/features/**/*'],
    },
  },

  // Webpack配置
  webpack: (config, { isServer }) => {
    // 确保解析 src 别名
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
```

### `vercel.json`（构建命令调整）

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  
  "buildCommand": "npm run prebuild && next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  
  // 环境变量配置
  "env": {
    "POSTGRES_URL": "@postgres-url",
    "JWT_SECRET": "@jwt-secret"
  },

  // Functions配置
  "functions": {
    "src/app/api/tools/[toolId]/route.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  },

  // 构建缓存
  "cache": [
    {
      "key": "tool-registry",
      "path": "src/features/registry.ts",
      "purge": "always"
    }
  ]
}
```

---

## 四、开发脚本（`package.json`）

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "prebuild": "npm run build:registry && npm run build:docs",
    "new:tool": "node scripts/generate-tool.js",
    "build:registry": "ts-node scripts/update-registry.ts",
    "build:docs": "ts-node scripts/generate-docs.ts",
    "validate": "ts-node scripts/validate-tools.ts && next lint",
    "analyze": "cross-env ANALYZE=true next build"
  }
}
```

**注意**：`scripts/` 目录位于项目根，但生成的代码会正确指向 `src/features/`

---

## 五、方案合规性最终确认

### ✅ 完全符合 `src` 目录规范

1. **App Router位置**：`src/app/` ✓
2. **模块导入路径**：所有 `@/*` 别名指向 `src/` ✓
3. **配置文件**：`next.config.js`、`middleware.ts` 保留在根目录 ✓
4. **构建输出**：`.next` 仍在根目录，不影响Vercel部署 ✓
5. **TypeScript解析**：`baseUrl` 和 `paths` 正确配置 ✓

### ✅ Vercel部署兼容性

- **构建命令**：自动识别 `src/app` 结构
- **函数路径**：`src/app/api/...` 正确编译为Serverless Functions
- **中间件**：根 `middleware.ts` 和 `src/app/(tools)/middleware.ts` 均有效
- **环境变量**：从根目录 `.env.local` 正确加载

---

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

# UI要求

# 上一步的改动
无

# 本次需求
