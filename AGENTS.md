# tool — eve Agent App

基于 eve 框架的 AI 聊天工具，集成 anysearch 实时搜索能力。

## 技术栈

- **框架**: eve + Next.js 16
- **模型**: LongCat 2.0 (OpenAI-compatible API)
- **认证**: 无认证，单用户模式 (local-app)，X-API-Key 服务间鉴权
- **数据库**: 无（对话仅存内存，刷新即丢失）
- **包管理**: npm
- **搜索**: anysearch skill (web/vertical/batch search)

## 开发

```bash
npm install
npm run dev        # Next.js dev server
npm run eve:dev    # eve dev runtime
```

## 环境变量

参考 `.env.example`：
- `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `EVE_MODEL` — LongCat API
- `AGENT_API_KEY` — 服务间共享密钥（由 Next.js middleware 注入 X-API-Key，浏览器不可见）

## 部署

Vercel 部署，`vercel.json` 配置了 web (Next.js) 和 eve 两个 service。

## 注意事项

- 本项目从 eve-chat-template 改造而来，已移除认证 (better-auth)、数据库 (Neon/Drizzle/Supabase)、connections (Notion/Linear/Sentry) 等模板功能。
- 重构计划见 `REFACTOR_PLAN.md`。
- 使用 `eve` 小写作为品牌名。
