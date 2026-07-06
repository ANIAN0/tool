# tool 项目重构计划

> 从 eve-chat-template 复制改造，需清理大量未改造的模板代码并修复功能 bug。
> 阶段 4（Supabase 数据库接入）单独执行，其余阶段先行。

## 执行顺序

- **本轮执行**：阶段 1 → 2 → 3 → 5 → 6 → 7 → 8 ✅ 已完成
- **单独执行**：阶段 4（待 Supabase 连接串就绪后）

---

## 阶段 1：P0 功能 Bug 修复 ✅

- [x] 1.1 创建 `public/eve.svg`（从模板复制，修复首页 logo + 骨架屏 404）
- [x] 1.2 `agent-chat.tsx` 移除 `createConnectionClientContext` 调用（停止向 LLM 发送虚假连接信息）

## 阶段 2：彻底删除 Connections/Integrations 全套 ✅

- [x] 2.1 删除 `components/chat/integrations-menu.tsx`
- [x] 2.2 `chat-shell-context.tsx` 删除 `EnabledConnections` 类型及相关 context 字段
- [x] 2.3 `agent-chat-shell.tsx` 删除 `enabledConnections` state、`setConnectionEnabled`
- [x] 2.4 `agent-chat.tsx` 删除 connection 全部代码（`CONNECTION_LABELS`/`createConnectionClientContext`/`PendingConnectionAuthorization` 及相关函数/组件/`IntegrationsMenu` 引用）
- [x] 2.5 `components/icons.tsx` 删除 `NotionIcon`/`LinearIcon`/`SentryIcon`（整个文件已删除）
- [x] 2.6 `app/actions/chat.ts` 删除 `skipChatAuthorizationAction`
- [x] 2.7 全局清理残留导入

## 阶段 3：删除模板品牌残留 ✅

- [x] 3.1 删除 `components/chat/template-footer-links.tsx`
- [x] 3.2 `home-chat-page.tsx` 移除 `TemplateFooterLinks` 导入和渲染
- [x] 3.3 `agent-chat-skeleton.tsx` 移除 `TemplateFooterLinks` 导入和渲染
- [x] 3.4 `sidebar.tsx` `VercelIcon` → `EveImageMark`
- [x] 3.5 `agent-chat-skeleton.tsx` `VercelIcon` → `EveImageMark`
- [x] 3.6 `components/icons.tsx` 整个文件删除（VercelIcon/GitHubIcon/NotionIcon 等全部清除）
- [x] 3.7 `composer.tsx` placeholder/label 去掉 "eve"

## 阶段 4：接入 Supabase 数据库（单独执行）

> 前提：用户提供 Supabase `DATABASE_URL`

- [ ] 4.1 `package.json` 添加 `drizzle-orm`/`postgres`/`drizzle-kit` + db scripts
- [ ] 4.2 新建 `lib/db/schema.ts`（仅 `chat` + `chatEvent` 两张表）
- [ ] 4.3 新建 `lib/db/client.ts`（postgres-js + Supabase 连接池 `prepare: false`）
- [ ] 4.4 新建 `drizzle.config.ts`
- [ ] 4.5 重写 `lib/db/queries.ts`（真实实现）
- [ ] 4.6 重写 `app/actions/chat.ts`（真实实现，去掉 rate-limit/connection）
- [ ] 4.7 重写 `app/api/chats/route.ts`
- [ ] 4.8 重写 `app/api/chats/[id]/route.ts`
- [ ] 4.9 重写 `app/api/bootstrap/route.ts`
- [ ] 4.10 `.env` 添加 `DATABASE_URL`
- [ ] 4.11 `lib/setup.ts` + `lib/chat/types.ts` `SetupStatus` 终态：`{ appReady, databaseConfigured, databaseSchemaReady, missing }`

## 阶段 5：清理残留提示文案和 Auth 死代码 ✅

- [x] 5.1 `agent-chat.tsx` `getSetupRequiredReason` 移除 auth/rate-limit 分支，改为检查 missing env
- [x] 5.2 `home-chat-page.tsx` `getHomeComposerDisabledReason` 同上
- [x] 5.3 `session-chat-page.tsx` `getSessionComposerDisabledReason` 同上
- [x] 5.4 `agent-chat-shell.tsx` 删除 auth 死代码（`requestSignIn`/`authDialogOpen`/`SignInModal`/`AuthTopActions`/`AuthDisplayLoggedOut` 等）
- [x] 5.5 `sidebar.tsx` 删除 auth 死代码（`onSignIn`/`SidebarSignInButton`/`AuthDisplayLoggedIn`/`AuthDisplayLoggedOut`/`UserMenu`/`authDisabled`/`isLoadingChats`/`setupStatus` props）
- [x] 5.6 `home-chat-page.tsx` 删除 `if (!viewer) { requestSignIn() }` 分支
- [x] 5.7 `session-chat-page.tsx` 删除 `if (!viewer)` 检查
- [x] 5.8 删除 `components/auth/` 整个目录

## 阶段 6：修复 page.tsx 和路由逻辑 ✅

- [x] 6.1 `app/(chat)/chat/[id]/page.tsx` 加回 `isProvisionalChatId` 检查 + `notFound()`
- [x] 6.2 `app/(chat)/chat/[id]/loading.tsx` 返回 `<AgentChatSkeleton mode="chat" />`
- [x] 6.3 修复 `lib/db/queries.ts` `getChatForUser` stub 参数名（`_chatId, _userId`）

## 阶段 7：修复字体和 Metadata ✅

- [x] 7.1 `app/layout.tsx` 加回 `next/font/google` Geist + Geist_Mono
- [x] 7.2 `app/layout.tsx` 补充 metadata（icons）
- [x] 7.3 新建 `app/icon.svg` favicon

## 阶段 8：配置和工程清理 ✅

- [x] 8.1 `.npmrc` 保留 `legacy-peer-deps=true`（验证阶段未移除，待后续评估）
- [x] 8.2 `tsconfig.json` target ES2017 → ES2022
- [x] 8.3 新建 `components.json`（shadcn/ui 配置）
- [ ] 8.4 eslint 配置（暂缓，模板也无）
- [x] 8.5 更新 `AGENTS.md` 为项目特定说明
- [x] 8.6 更新 `agent/instructions.md` 补充 anysearch skill 引导
- [x] 8.7 新建 `.env.example`
- [x] 8.8 新建 `README.md`

---

## 验证 ✅

1. ✅ `npx tsc --noEmit -p tsconfig.json` 类型检查通过（零错误）
2. 残留扫描通过（无 Notion/Linear/Sentry/VercelIcon/TemplateFooterLinks/Auth 等模板引用）
