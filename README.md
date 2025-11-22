# 功能工具箱

基于 Next.js 16.0.3 的功能工具箱项目，部署在 Vercel。

---

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问应用
# http://localhost:3000
```

---

## 文档导航

- **[PROJECT.md](./PROJECT.md)** - 项目说明（基本信息、功能清单、页面和接口说明）
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 开发规范（架构、流程、代码规范）
- **[REQUIREMENTS.md](./REQUIREMENTS.md)** - 需求文档（当前需求、历史需求、改动记录）

---

## 当前功能

### 1. 图片拼接工具
- 📍 页面: `/public-tools/image-merger`
- 📡 API: `/api/tools/image-merger?op=merge`
- 📖 文档: `/docs/api/image-merger`

---

## 创建新工具

```bash
# 使用脚本快速创建
npm run new:tool

# 更新注册表
npm run build:registry
```

详细开发指南请查看 [DEVELOPMENT.md](./DEVELOPMENT.md)

---

## 部署

```bash
# 部署到Vercel生产环境
vercel --prod
```

---

## 技术栈

- Next.js 16.0.3 (App Router)
- TypeScript
- Tailwind CSS
- Sharp (图片处理)
- Vercel (部署平台)
