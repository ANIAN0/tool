# 多功能工具集合应用

一个集成了多种实用工具的 Web 应用，包括文件分享、快速笔记、剪贴板等功能。

## 技术架构

### 前端技术栈
- **框架**: Next.js 15.2.4 (App Router)
- **语言**: TypeScript
- **UI 框架**: 
  - Tailwind CSS
  - Radix UI (无障碍组件库)
  - Lucide React (图标库)
- **状态管理**: React Hooks
- **表单处理**: React Hook Form + Zod
- **动画效果**: CSS Animations
- **工具库**:
  - date-fns (日期处理)
  - uuid (唯一标识符)
  - sonner (提示消息)

### 后端技术栈
- **数据库**: Supabase
- **认证**: Supabase Auth
- **文件存储**: Supabase Storage
- **API**: Next.js API Routes
- **实时功能**: Supabase Realtime

## 项目结构

```
src/
├── app/                    # 主应用目录
│   ├── api/               # API 路由
│   │   ├── files/        # 文件相关 API
│   │   ├── notes/        # 笔记相关 API
│   │   └── user/         # 用户相关 API
│   ├── auth/             # 认证相关页面
│   ├── file-share/       # 文件分享功能
│   ├── quick-note/       # 快速笔记功能
│   ├── clipboard/        # 剪贴板功能
│   └── protected/        # 受保护路由
├── components/           # 共享组件
├── lib/                  # 工具函数和配置
└── hooks/               # 自定义 Hooks
```

## 功能清单

### 1. 文件分享 (File Share)
- 文件上传与管理
- 支持多种文件格式
- 实时文件列表更新
- 文件预览功能
- 支持网格/列表视图切换
- 文件搜索和排序

### 2. 快速笔记 (Quick Note)
- 实时笔记创建和编辑
- Markdown 支持
- 笔记列表管理
- 实时同步
- 搜索和排序功能

### 3. 用户认证
- 邮箱登录/注册
- 社交媒体登录
- 用户配置文件
- 权限管理

## API 清单

### 文件管理 API
```typescript
// 文件上传
POST /api/files
// 文件删除
DELETE /api/files/:id
// 获取文件列表
GET /api/files
// 更新文件信息
PATCH /api/files/:id
```

### 笔记管理 API
```typescript
// 创建笔记
POST /api/notes
// 获取笔记列表
GET /api/notes
// 更新笔记
PATCH /api/notes/:id
// 删除笔记
DELETE /api/notes/:id
```

### 用户管理 API
```typescript
// 用户信息
GET /api/user/profile
// 更新用户设置
PATCH /api/user/settings
```

## 开发命令

```bash
# 开发环境启动
npm run dev

# 构建项目
npm run build

# 生产环境启动
npm run start

# 代码检查
npm run lint
```

## 部署

项目使用 Vercel 进行部署，支持以下功能：
- 自动化部署
- 环境变量管理
- SSL 证书
- CDN 加速

## 环境变量配置

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 其他配置
NEXT_PUBLIC_APP_URL=your_app_url
```

## 版本历史

### v0.1.0
- 初始版本发布
- 实现基础文件分享功能
- 实现快速笔记功能
- 完成用户认证系统
- 基础 UI 框架搭建


