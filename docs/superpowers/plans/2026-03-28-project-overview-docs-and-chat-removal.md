# 项目概况文档与旧版 Chat 下线 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，按任务逐步实施。步骤使用 `- [ ]` 勾选追踪。

**Goal:** 移除旧 `/chat` 与 `/api/chat` 及 `components/chat` 遗留实现，统一入口为 `/agent-chat`；在 `docs/项目最新概况/` 按 01 骨架补齐 `02`～`07` 并更新 `01`；删除 `docs/功能开发/沙盒服务部署实施文档.md`，由 `05沙盒服务与对接说明.md` 单篇承载沙盒全文。

**Architecture:** 先迁移共享输入组件 `prompt-section` 再删除旧 Chat 目录；全仓替换 `/chat` 站内引用；不写重定向；文档以规格 [2026-03-28-project-overview-docs-and-chat-removal-design.md](../specs/2026-03-28-project-overview-docs-and-chat-removal-design.md) 与代码为唯一事实来源。

**Tech Stack:** Next.js 15 + React 19 + TypeScript + Turso；AI SDK；现有 `lib/sandbox/*` 与 `sandbox-service/`（Python）。

**依据规格：** `docs/superpowers/specs/2026-03-28-project-overview-docs-and-chat-removal-design.md`

---

## 文件结构（将创建 / 修改 / 删除）

| 路径 | 动作 |
|------|------|
| `components/agent-chat/prompt-section.tsx` | **创建**（自 `components/chat/prompt-section.tsx` 迁移） |
| `components/agent-chat/agent-chat-client.tsx` | **修改** import |
| `components/chat/*`（除已迁出的文件） | **删除** |
| `app/chat/layout.tsx`, `app/chat/[id]/page.tsx` | **删除** |
| `app/api/chat/route.ts` | **删除** |
| `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` | **修改** `/chat` → `/agent-chat` |
| `components/auth/login-form.tsx` | **修改** 跳转与成功回调路径 |
| `app/page.tsx`、`app/settings/**` 等 | **检索** 若有 `/chat` 则改 |
| `docs/项目最新概况/01…07*.md` | **创建或更新**（目录不存在则新建） |
| `docs/功能开发/沙盒服务部署实施文档.md` | **删除**（在 05 正文完成后执行） |

> **注意：** 当前 `.gitignore` 中 `docs/**` 仅放行 `docs/superpowers/**`。`docs/项目最新概况/` 默认不进 Git；若你希望概况文档被版本管理，需在后续单独调整 `.gitignore`（本计划不强制执行）。

---

### Task 1：迁移 `prompt-section` 并消除对 `components/chat` 的引用

**Files:**
- Create: `components/agent-chat/prompt-section.tsx`
- Modify: `components/agent-chat/agent-chat-client.tsx`
- Delete（稍后 Task 2 一并删亦可）: 迁移完成后删除旧文件 `components/chat/prompt-section.tsx`

- [ ] **Step 1：** 将 `components/chat/prompt-section.tsx` **原样复制**到 `components/agent-chat/prompt-section.tsx`（保持 ai-elements 引用不变；不修改 `components/ai-elements/**`）。

- [ ] **Step 2：** 在 `components/agent-chat/agent-chat-client.tsx` 中把  
  `import { PromptSection } from "@/components/chat/prompt-section"`  
  改为  
  `import { PromptSection } from "@/components/agent-chat/prompt-section"` 或相对路径 `./prompt-section`。

- [ ] **Step 3：** 运行 `npm run build`（项目根目录）。  
  **预期：** 编译通过（允许其它与 Chat 相关的未删文件仍暂时存在）。

- [ ] **Step 4：** `git add` 相关文件并提交，message 示例：`refactor(chat): 迁移 prompt-section 至 agent-chat`

---

### Task 2：删除旧 Chat 路由、API 与组件

**Files:**
- Delete: `app/chat/layout.tsx`
- Delete: `app/chat/[id]/page.tsx`
- Delete: `app/api/chat/route.ts`
- Delete: `components/chat/chat-client.tsx`
- Delete: `components/chat/model-selector.tsx`
- Delete: `components/chat/agent-selector.tsx`
- Delete: `components/chat/sidebar.tsx`
- Delete: `components/chat/sidebar-item.tsx`
- Delete: `components/chat/index.ts`
- Delete: `components/chat/prompt-section.tsx`（若 Task 1 已迁移且引用已更新）

- [ ] **Step 1：** 全仓检索 `components/chat`、`/api/chat`、`ChatClient`、`app/chat`。  
  Run: `rg "components/chat|/api/chat|ChatClient|app/chat" --glob "*.tsx" --glob "*.ts"`  
  **预期：** 除本计划已处理文件外无业务引用（`open-in-chat.tsx` 中 `chatgpt.com` 可忽略）。

- [ ] **Step 2：** 删除上表所列文件；若 `components/chat` 已空，删除该目录。

- [ ] **Step 3：** `npm run build`  
  **预期：** 成功。

- [ ] **Step 4：** 提交，message 示例：`chore: 移除旧 Chat 页面与 /api/chat`

---

### Task 3：站内链接与跳转统一到 `/agent-chat`

**Files（按检索结果补齐）:**
- Modify: `components/auth/login-form.tsx`（`router.push("/chat")` → `"/agent-chat"`）
- Modify: `app/(auth)/login/page.tsx`（`href="/chat"` → `"/agent-chat"`）
- Modify: `app/(auth)/register/page.tsx`（`onSuccess`、`href`）
- Modify: `app/page.tsx`、`app/settings/layout.tsx` 等（若存在 `/chat`）

- [ ] **Step 1：** `rg "\"/chat\""` 与 `rg "'/chat'"` 与 `rg "/chat/"`  
  **预期：** 无站内跳转仍指向已删除路由（外部 URL 除外）。

- [ ] **Step 2：** 逐文件修改并保存。

- [ ] **Step 3：** `npm run build`  
  **预期：** 成功。

- [ ] **Step 4：** 提交，message 示例：`fix: 登录与导航统一指向 /agent-chat`

---

### Task 4：终验（代码侧）

- [ ] **Step 1：** 再次运行  
  `rg "components/chat|/api/chat|ChatClient|from \"@/components/chat"`  
  **预期：** 无匹配（或仅说明性注释，若有则删除注释中的过时路径）。

- [ ] **Step 2：** **确认未添加** `/chat` → `/agent-chat` 的 Next `redirect`（规格要求 404）。

- [ ] **Step 3：** `npm run build`  
  **预期：** 成功。

- [ ] **Step 4（手工）：** 浏览器打开 `/agent-chat`、登录/注册流试一次；直接访问 `/chat` **应 404**。

---

### Task 5：更新 `docs/项目最新概况/01登录注册鉴权说明.md`

**Files:**
- Modify: `docs/项目最新概况/01登录注册鉴权说明.md`（路径以本机为准；若目录不存在先创建）

- [ ] **Step 1：** 对照规格 **§6**，补充或修正：`anonymousId`、`migrateMcpData`、MCP API 与 `authenticateRequestOptional`、主导航 `/agent-chat`、环境变量表、`lib/db/mcp` 路径表。

- [ ] **Step 2：** 与 `app/api/auth/login/route.ts`、`register/route.ts`、`lib/auth/middleware.ts` 快扫一遍，避免文档与代码冲突。

- [ ] **Step 3：** 若你使用 Git 跟踪该目录则提交；否则本地留存。

---

### Task 6：撰写 `02模型配置说明.md`

**Files:**
- Create: `docs/项目最新概况/02模型配置说明.md`

- [ ] **Step 1：** 按规格 **§3** 骨架，从 `lib/db/schema`（user_models）、`lib/db` CRUD、`lib/encryption`、`app/settings/models/**`、`app/api/agent-chat/route.ts` 中 `buildChatModelFromUserModel` 抽取准确描述。

- [ ] **Step 2：** 写清 provider（openrouter / openai）、`base_url`、默认模型降级。

---

### Task 7：撰写 `03mcp与mcptool注册说明.md`

**Files:**
- Create: `docs/项目最新概况/03mcp与mcptool注册说明.md`

- [ ] **Step 1：** 覆盖 `app/api/mcp/**`、`lib/db/mcp`、`migrateMcpData`、匿名访问语义。

---

### Task 8：撰写 `04系统内置tool说明.md`

**Files:**
- Create: `docs/项目最新概况/04系统内置tool说明.md`

- [ ] **Step 1：** 以 `app/api/tools/route.ts` 的 `SYSTEM_TOOLS` 与 Agent `enabledSystemTools`、`app/api/agents/**` 为准。

---

### Task 9：撰写 `05沙盒服务与对接说明.md` 并删除旧沙盒实施文档

**Files:**
- Create: `docs/项目最新概况/05沙盒服务与对接说明.md`
- Delete: `docs/功能开发/沙盒服务部署实施文档.md`
- Reference: `sandbox-service/**`、`lib/sandbox/**`、`.env.example`

- [ ] **Step 1：** 阅读 `sandbox-service/README.md`、`deploy/*`、`src/**/*.py`（若存在）、`lib/sandbox/session-manager.ts`（API 路径：`/api/v1/sessions/:id/exec|read|write|heartbeat`、`/status`）、`lib/sandbox/tools.ts`、`config.ts`。

- [ ] **Step 2：** 撰写 **05**：架构、部署、Gateway 契约（与 `session-manager` 一致）、环境变量、与 `app/api/agent-chat/route.ts` 中 `getSandboxToolsWithContext` 的集成、安全与排错。

- [ ] **Step 3：** 删除 `docs/功能开发/沙盒服务部署实施文档.md`（**仅**在 05 内容已覆盖且无团队异议后执行）。

---

### Task 10：撰写 `06agent配置说明.md`

**Files:**
- Create: `docs/项目最新概况/06agent配置说明.md`

- [ ] **Step 1：** 覆盖 `app/api/agents/**`、`lib/db/agents.ts`、`lib/agents/templates.ts`、`app/settings/agents/**`。

---

### Task 11：撰写 `07agentchat页面说明.md`

**Files:**
- Create: `docs/项目最新概况/07agentchat页面说明.md`

- [ ] **Step 1：** 覆盖 `app/agent-chat/**`、`components/agent-chat/**`、`app/api/agent-chat/route.ts`、`app/api/agent-conversations/route.ts`；**不得**将主入口写成 `/chat`。

---

### Task 12：总验收（规格 §2.2）

- [ ] **Step 1：** 逐项核对规格 **成功标准** 清单全部勾选。

- [ ] **Step 2：** 可选：在 `docs/功能开发/新增需求.md` 或 PR 描述中记录完成情况（若你维护该清单）。

---

## 规格审阅（计划）

本计划写完后，建议由 **plan-document-reviewer** 对照规格全文做一次独立审阅；若发现问题，由同一作者修订本计划并重新审阅（至多 3 轮后上报 human）。

---

## 执行交接

计划已保存至 `docs/superpowers/plans/2026-03-28-project-overview-docs-and-chat-removal.md`。

**执行方式二选一：**

1. **Subagent-Driven（推荐）** — 按任务派发子代理，任务间复核；需使用 **subagent-driven-development** 技能。  
2. **Inline Execution** — 本会话内按 checkpoints 批量执行；需使用 **executing-plans** 技能。

你更倾向哪一种？

---

**附：** Cursor 的 `/write-plan` 命令已弃用；后续请直接要求使用 **superpowers writing-plans** 或指向本 `plans` 文件即可。
