# tool

基于 eve 框架的 AI 聊天工具，集成实时搜索能力。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际值

# 3. 启动开发服务器
npm run dev
```

打开 http://localhost:3000

## 技术栈

- [eve](https://eve.dev) — AI agent 框架
- [Next.js](https://nextjs.org) 16 — Web 框架
- LongCat 2.0 — AI 模型 (OpenAI-compatible)
- [anysearch](./agent/skills/anysearch) — 实时搜索
- Tailwind CSS 4 + shadcn/ui

## 部署

部署到 Vercel，参考 `vercel.json` 中的双 service 配置 (web + eve)。

## 项目结构

```
agent/          — eve agent 定义 (模型、channel、skills)
app/            — Next.js App Router
components/     — React 组件 (chat UI, shadcn/ui)
lib/            — 工具函数 (chat 逻辑, db, session)
public/         — 静态资源
```
