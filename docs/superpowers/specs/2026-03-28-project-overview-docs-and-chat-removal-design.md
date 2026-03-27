# 设计说明：项目最新概况文档体系与旧版 Chat 下线

> **文档目的：** 在选项 A（按 `docs/功能开发/新增需求.md` 自 1→8 推进）前提下，先固定技术设计与文档结构，再进入编码与《项目最新概况》正文编写，避免实现与文档漂移。  
> **范围：** 任务 1（旧 Chat 移除）、任务 2（01 鉴权文档核对）、任务 3～8（02～07 新增说明的结构与信息源）。  
> **非范围：** 沙盒服务端（Python/nsjail/Gateway）的具体部署步骤以现有 `docs/功能开发/沙盒服务部署实施文档.md` 为准；本设计只规定 **05** 如何引用与写「对接面」。

**版本：** v0.1（设计稿）  
**日期：** 2026-03-28

---

## 1. 方案比选（为何采用单一总规）

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A. 单一总规（推荐）** | 本篇 + 后续按同一顺序改代码、写 02～07 | 依赖关系清晰（先删 Chat 再避免文档里仍写 `/chat`）；验收简单 | 文档较长，需目录跳转 |
| **B. 拆成两份规格** | 「Chat 下线规格」与「概况文档规格」分文件 | 可并行阅读 | 容易不一致（例如链接、路由改名不同步） |
| **C. 仅写 02～07 提纲** | 不做移除 Chat 的详细清单 | 动笔快 | 任务 1 实施时易漏改入口、API、共享组件 |

**推荐：方案 A。** 与你在「A，我们先完成设计文档」中的意图一致：**先有一份可追溯的设计，再动代码与《项目最新概况》正文。**

---

## 2. 目标与成功标准

### 2.1 产品/维护目标

- 用户侧主对话入口统一为 **`/agent-chat`**，旧 **`/chat`**、**`/api/chat`** 及相关「旧 agent 组装」逻辑移除或可证明无引用。
- `docs/项目最新概况/` 下补齐 **02～07**，与 **01** 同级、同风格，便于非开发阅读与关键开发防回归。
- **01** 与当前实现对齐（含匿名用户、登录注册附带能力等变更）。

### 2.2 成功标准（验收清单）

- [ ] 全仓无对 `/api/chat`、`ChatClient`、`app/chat` 路由的有效引用（除刻意保留的 SEO/重定向若有）。
- [ ] `login` / `register` / `login-form` 等跳转目标为 **`/agent-chat`**（或与根布局导航一致）。
- [ ] 共享 UI 组件无「挂在将被删除目录下」的依赖（见第 4.2 节）。
- [ ] `docs/项目最新概况/02～07.md` 均已创建，且每篇包含与 01 对齐的固定章节（见第 5 节）。
- [ ] **01** 已按第 6 节核对清单更新或明确标注「无需改」。

---

## 3. 文档体系结构（《项目最新概况》）

所有 02～07 建议沿用 **01** 的骨架，便于检索：

1. 标题 + 文档目的 + 系统概述 + 技术栈  
2. **目录**（锚点列表）  
3. **系统架构**（流程图或模块表）  
4. **数据库设计**（若该主题无独立表可写「无」或「见 01 / 见 xx」）  
5. **后端实现**（路由、核心函数、请求/响应形状）  
6. **前端实现**（页面路径、关键 Hook/组件）  
7. **使用指南**（如何配置、如何调用）  
8. **注意事项**（安全、限制、降级）  
9. **相关文件清单**（表格）  
10. 创建时间 / 最后更新 / 版本  

各文件命名与 `新增需求.md` 一致：

| 编号 | 文件名 | 主题 |
|------|--------|------|
| 02 | `02模型配置说明.md` | 用户模型、加密存储、OpenRouter / OpenAI-Compatible |
| 03 | `03mcp与mcptool注册说明.md` | MCP 服务 CRUD、匿名可访问、工具列表、状态检测 |
| 04 | `04系统内置tool说明.md` | `app/api/tools` 中 `SYSTEM_TOOLS`、与 Agent `enabledSystemTools` 的关系 |
| 05 | `05沙盒服务与对接说明.md` | Next `lib/sandbox/*`、环境变量、Gateway HTTP 对接、与 Agent Chat 的衔接 |
| 06 | `06agent配置说明.md` | Agent CRUD、模板、`enabledSystemTools`、公开/私有 |
| 07 | `07agentchat页面说明.md` | `/agent-chat` 路由、客户端、`/api/agent-chat`、`/api/agent-conversations` |

---

## 4. 任务 1：旧版 Chat 下线（设计级清单）

### 4.1 当前代码事实（以仓库检索为准，实施前再扫一遍）

- **路由：** `app/chat/layout.tsx`、`app/chat/[id]/page.tsx` 存在；根路径 **`/chat` 的 `page.tsx` 若不存在**，则部分客户端逻辑仍假设 `/chat` 作为「新会话」页，需统一改为 `/agent-chat`。
- **API：** `app/api/chat/route.ts` 为旧对话后端。
- **组件目录：** `components/chat/` 内含 `chat-client.tsx`、`model-selector`、`agent-selector`、`sidebar`、`prompt-section` 等。
- **复用关系：** `components/agent-chat/agent-chat-client.tsx` 仍引用 `@/components/chat/prompt-section`。

### 4.2 推荐拆除与迁移策略

1. **先迁移再删除：** 将 **`prompt-section.tsx`（仅该文件若仍被 Agent Chat 使用）** 移到 `components/agent-chat/`（或 `components/shared/chat-ui/`，二选一；**推荐 `components/agent-chat/`** 以减少新概念目录），并改 import。
2. **删除仅被旧 Chat 使用的文件：** `chat-client.tsx`、`model-selector.tsx`、`agent-selector.tsx`、`sidebar.tsx`、`sidebar-item.tsx`、`components/chat/index.ts` 等——以实施时 `grep` 零引用为准。
3. **删除路由与 API：** `app/chat/**`、`app/api/chat/route.ts`。
4. **全局替换入口：**  
   - `app/(auth)/login/page.tsx`、`register/page.tsx`、`components/auth/login-form.tsx` 等中的 **`/chat` → `/agent-chat`**。  
   - `app/page.tsx`、主导航、设置页返回链接若有 `/chat` 一并替换。
5. **可选：** 增加 Next **redirect** ` /chat` → `/agent-chat`（仅当需要兼容书签；若不希望永久保留旧 URL，可在设计阶段决定是否做 301/302，默认建议 **首页或统一 notFound** 以避免隐式行为，由你拍板）。

### 4.3 风险与缓解

| 风险 | 缓解 |
|------|------|
| 误删仍被 settings 或其它页面引用的 chat 组件 | 删除前全仓 `rg "components/chat"` |
| Agent Chat 与旧 Chat 对 Prompt 行为不一致 | 迁移 `prompt-section` 后做一次手工对话回归 |

---

## 5. 任务 3～8：各文档「信息源」索引（撰写时以此为准）

### 5.1 02 模型配置说明

- **优先源：** `lib/db` 中与 user_models 相关的 schema/CRUD、`lib/encryption`（API Key 加密）、设置页 `app/settings/models/**`、Agent 路由里 `buildChatModelFromUserModel`（`app/api/agent-chat/route.ts`）。
- **要点：** provider 枚举、`base_url`、默认模型降级逻辑。

### 5.2 03 MCP 与 MCP Tool

- **优先源：** `app/api/mcp/**`、`lib/db/mcp`（含迁移）、`authenticateRequestOptional` 行为、`migrateMcpData` 与登录注册请求体中的 `anonymousId`。
- **要点：** 匿名可配置 MCP、工具列表缓存、status 检测。

### 5.3 04 系统内置 Tool

- **优先源：** `app/api/tools/route.ts` 中 `SYSTEM_TOOLS`；Agent 表/更新 API 中的 `enabledSystemTools`；`app/api/agents/**`。
- **要点：** `system:*` id 约定、与 MCP 工具合并展示的逻辑（若有前端消费）。

### 5.4 05 沙盒服务与对接说明

- **Next 侧：** `lib/sandbox/config.ts`、`session-manager.ts`、`tools.ts`、`types.ts`、`index.ts`；环境变量与 `.env.example` 沙盒段。
- **行为：** `SANDBOX_ENABLED === 'true'` 且 URL/API Key 校验通过才可用工具；`getSandboxToolsWithContext({ conversationId, userId })` 与 `/api/agent-chat` 的集成。
- **对外部署：** **不重复**长文部署——在 05 中写摘要架构图 + **链接** `docs/功能开发/沙盒服务部署实施文档.md`；写明 Gateway 路径前缀（如 `/api/v1/sessions/...`）与认证头（`Authorization: Bearer`）与请求字段名，与 `session-manager.ts` 保持一致。

### 5.5 06 Agent 配置说明

- **优先源：** `app/api/agents/**`、`lib/db/agents.ts`、`lib/agents/templates.ts`、设置页 `app/settings/agents/**`。
- **要点：** 公开/私有、`template_config` JSON、模型与工具 ID 关联。

### 5.6 07 Agent Chat 页面说明

- **优先源：** `app/agent-chat/**`、`components/agent-chat/**`、`app/api/agent-chat/route.ts`、`app/api/agent-conversations/route.ts`。
- **要点：** `X-User-Id` 头、`conversationId` 与建链、`source: 'agent-chat'`、流式响应类型。

---

## 6. 任务 2：`01登录注册鉴权说明.md` 核对清单

实施文档更新时逐项打勾：

- [ ] **登录/注册请求体** 是否补充 **`anonymousId`**（用于 MCP 数据迁移）及服务端 `migrateMcpData` 说明（见 `app/api/auth/login/route.ts`、`register/route.ts`）。
- [ ] **MCP 相关 API** 是否从「仅登录」改为 **optional auth** 的表述与 `authenticateRequestOptional` 示例是否需加入（避免与 01 中原 `withAuth` -only 描述冲突）。
- [ ] 认证页主导航链接是否由 `/chat` 改为 **`/agent-chat`**（与布局一致）。
- [ ] **环境变量 / 关键配置清单** 是否与 `.env.example` 一致（JWT、Turso、邀请码等；沙盒项可仅引用 05）。
- [ ] **文件路径表** 是否增补 `lib/db/mcp` 等迁移相关模块。

若某项与现状一致则标注「无需修改」并保留审查记录一句。

---

## 7. 实施顺序（设计批准之后）

1. **编码：** 完成任务 1（迁移 `prompt-section` → 删除旧 chat → 替换入口与 API）。  
2. **文档：** 更新任务 2（01），再按 02→07 顺序撰写（可并行多篇，但 07 依赖任务 1 完成以免仍描述 `/chat`）。  
3. **终验：** 执行第 2.2 节验收清单；可选跑一次 `npm run build` 确认路由与类型无残留。

---

## 8. 待你确认的设计决策（实现前拍板）

1. **旧 `/chat`：** 是否需要 **永久重定向** 到 `/agent-chat`？（建议：要，减少用户书签断裂；若担心 SEO/统计可只保留 302。）  
2. **`prompt-section` 归宿：** 是否同意放在 **`components/agent-chat/`**？  
3. **05 与部署长文：** 是否同意 **05 仅写对接面 + 链接**，不复制部署长文？

---

## 9. 相关仓库路径（设计索引）

- 需求列表：`docs/功能开发/新增需求.md`  
- 文档样板：`docs/项目最新概况/01登录注册鉴权说明.md`  
- 沙盒部署详情：`docs/功能开发/沙盒服务部署实施文档.md`  
- Agent Chat API：`app/api/agent-chat/route.ts`  
- 沙盒客户端：`lib/sandbox/*`

---

**下一步：** 你确认第 8 节三点及全文无歧义后，可进入 **实现阶段**（按第 7 节顺序执行）；若需再拆 **implementation plan** 子文档，可单独追加 `docs/superpowers/plans/` 条目并与此设计交叉链接。
