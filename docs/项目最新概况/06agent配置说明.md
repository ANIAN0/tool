# Agent 配置说明

> **文档目的：** 说明 Agent 的创建、查询、更新、删除、公开范围及与模板、模型、工具、Skill 的关系。
> **系统概述：** Agent 存于数据库，由 **`/api/agents`** 系列路由暴露；支持 **公开**（`is_public`）与 **私有**（仅创建者）；通过 **`template_id` / `template_config`** 引用内置模板；可绑定 **`model_id`、`toolIds`、`enabledSystemTools`、`skillIds`**。
> **技术栈：** Next.js、`lib/db/agents.ts`、`lib/db/skills.ts`、`lib/agents/templates.ts`、`lib/agent-chat/runtime.ts`、`lib/workflowchat/agent-tools.ts`、`app/settings/agents/**`

---

## 目录

1. [系统架构](#1-系统架构)
2. [数据库设计](#2-数据库设计)
3. [后端实现](#3-后端实现)
4. [前端实现](#4-前端实现)
5. [使用指南](#5-使用指南)
6. [注意事项](#6-注意事项)
7. [相关文件清单](#7-相关文件清单)

---

## 1. 系统架构

| 模块 | 路径 | 职责 |
|------|------|------|
| 列表/创建 | `app/api/agents/route.ts` | GET 列表（我的 + 公开）、POST 创建 |
| 详情/改/删 | `app/api/agents/[id]/route.ts` | GET/PUT/DELETE |
| 公开切换 | `app/api/agents/[id]/publish/route.ts` | PATCH `isPublic` |
| 数据访问 | `lib/db/agents.ts` | CRUD、权限判断、Skill 关联管理 |
| Skill 数据访问 | `lib/db/skills.ts` | Agent-Skill 关联操作 |
| 模板校验 | `lib/agents/templates.ts` | `validateTemplateConfig` |
| MCP 运行时适配器 | `lib/agents/mcp-runtime.ts` | 桥接外部配置和 MCP 运行时（调用 `lib/infra/mcp/runtime.ts`） |
| MCP 运行时核心 | `lib/infra/mcp/runtime.ts` | MCP 运行时实现（服务器连接、工具发现、执行） |
| 系统工具定义 | `lib/infra/tools/system.ts` | 系统工具 ID 常量、校验、序列化/反序列化 |
| 工具注册中心 | `lib/infra/tools/registry.ts` | 全局工具注册表、工具创建/获取/注销 |
| 沙盒工具实现 | `lib/infra/sandbox/*.ts` | 沙盒环境工具（bash、readFile、writeFile 等） |
| Skills 服务 | `lib/infra/skills/skill-service.ts` | Skill 加载、执行、工具创建 |
| Agent 运行时创建 | `lib/agent-chat/runtime.ts` | 创建 Agent 运行时实例、执行 Agent 调用 |
| Agent 配置加载 | `lib/agent-chat/agent-loader.ts` | 从数据库加载 Agent 配置并解析运行时参数 |
| Agent 工具创建 | `lib/workflowchat/agent-tools.ts` | 根据 Agent 配置创建完整的工具集合 |
| Agent 定义 | `lib/workflowchat/agent.ts` | ToolLoopAgent 工厂函数、系统提示词构建 |
| 模型解析器 | `lib/agent-chat/model-resolver.ts` | 解析 Agent Chat 模型配置 |
| 设置 UI | `app/settings/agents/**` | 表单与列表 |
| Skill 选择器 | `components/settings/skill-selector.tsx` | Skill 选择组件 |
| Skill 预览 | `components/settings/skill-preset-preview.tsx` | 预置提示词预览组件 |
| 对外 API | `app/api/v1/agents/route.ts` | API Key 认证的 Agent 列表接口 |

**权限概要：**
- GET 单个：**公开 Agent** 任意可读；**私有** 仅创建者。
- PUT/DELETE/PATCH publish：**仅创建者**。
- POST 创建：**须已注册**用户（非匿名），见路由内 `isRegisteredUser`。
- 对外 API（`/api/v1/agents`）：需 **API Key 认证**，返回用户可访问的 Agent 列表。

---

## 2. 数据库设计

表字段与类型以 **`lib/schemas/agent.ts`** 和 **`lib/schemas/tool.ts`** 为准（旧路径 `lib/db/schema.ts` 已转为兼容层，统一 re-export 自 `@/lib/schemas`）。

### 2.1 Agent 相关表（`lib/schemas/agent.ts`）

| 表名 | 主要字段 | 说明 |
|------|----------|------|
| `agents` | `id`, `user_id`, `name`, `description`, `template_id`, `template_config`, `system_prompt`, `model_id`, `is_public`, `enabled_system_tools`, `created_at`, `updated_at` | Agent 主表 |
| `agent_tools` | `id`, `agent_id`, `tool_id`, `created_at` | Agent 与 MCP 工具多对多关联（UNIQUE(agent_id, tool_id)） |

### 2.2 Skill 相关表（`lib/schemas/tool.ts`）

| 表名 | 主要字段 | 说明 |
|------|----------|------|
| `user_skills` | `id`, `user_id`, `name`, `description`, `metadata`, `storage_path`, `file_hash`, `file_size`, `file_count`, `created_at`, `updated_at` | Skill 元数据主表 |
| `agent_skills` | `id`, `agent_id`, `skill_id`, `created_at` | Agent 与 Skill 多对多关联（UNIQUE(agent_id, skill_id)，级联删除） |

### 2.3 类型定义

| 类型 | 来源文件 | 说明 |
|------|----------|------|
| `Agent` | `lib/schemas/agent.ts` | Agent 基础类型 |
| `AgentTool` | `lib/schemas/agent.ts` | Agent-工具关联类型 |
| `AgentWithTools` | `lib/schemas/agent.ts` | Agent 详情（含工具列表、enabledSystemTools、skills） |
| `PublicAgentWithCreator` | `lib/schemas/agent.ts` | 公开 Agent（含 creator 创建者信息） |
| `CreateAgentParams` | `lib/schemas/agent.ts` | 创建 Agent 参数 |
| `UpdateAgentParams` | `lib/schemas/agent.ts` | 更新 Agent 参数 |
| `UserSkill` | `lib/schemas/tool.ts` | Skill 元数据类型 |
| `AgentSkill` | `lib/schemas/tool.ts` | Agent-Skill 关联类型 |

### 2.4 Agent 与 Skill 关联关系

Agent 通过中间表 **`agent_skills`** 与 Skill 建立多对多关联：

- 一个 Agent 可关联多个 Skill
- 一个 Skill 可被多个 Agent 使用
- Skill 删除时会级联删除 `agent_skills` 中的关联记录
- Agent 详情接口返回 `skills` 字段，包含关联 Skill 的简要信息（id、name、description）

---

## 3. 后端实现

### 3.1 `GET /api/agents`

- **已登录：** 返回 `myAgents` + `publicAgents`（排除自己的公开副本等业务规则以实现为准）。
- **匿名：** `myAgents` 可为空，仍可拉取 **公开** Agent。

使用 **`authenticateRequestOptional`**。

### 3.2 `POST /api/agents`

Body 常见字段：`name`、`description`、`templateId`、`templateConfig`、`systemPrompt`、`modelId`、`toolIds`、`enabledSystemTools`、`skillIds`。
- **`templateConfig`** 须经 **`validateTemplateConfig(templateId, config)`**。
- **`skillIds`** 传入后，系统自动强制启用必要的系统工具（bash、readFile、writeFile）。
- 创建成功后返回 201 与 Agent 对象。

**核心函数：** `createAgentWithSkills(params, skillIds)` - 同时处理 Agent 创建和 Skill 关联。

### 3.3 `PUT /api/agents/[id]`

部分更新：名称、描述、模板、系统提示词、`modelId`、`toolIds`、`enabledSystemTools`、`skillIds` 等；模板配置变更时同样校验。

**核心函数：** `updateAgentWithSkills(userId, agentId, params, skillIds)` - 同时处理 Agent 更新和 Skill 关联。

### 3.4 `PATCH /api/agents/[id]/publish`

Body：`{ isPublic: boolean }`，返回更新后的 **`getAgentById`** 结果（含工具和 Skill）。

### 3.5 `GET /api/v1/agents`（对外 API）

- 使用 **API Key 认证**（`authenticateApiKey`）
- 返回用户可访问的 Agent 列表（用户创建 + 公开的 Agent）
- 响应字段：`id`、`name`、`description`、`isPublic`、`isOwner`

### 3.6 Skill 关联相关函数

| 函数名 | 文件 | 说明 |
|--------|------|------|
| `getAgentsSkillsBatch(agentIds)` | `lib/db/skills.ts` | 批量获取多个 Agent 的 Skill 列表，避免 N+1 问题 |
| `setAgentSkills(agentId, skillIds)` | `lib/db/skills.ts` | 设置 Agent 关联的 Skill（先删后插） |
| `getAgentSkillsInfo(agentId)` | `lib/db/agents.ts` | 获取 Agent 关联的 Skill 详细信息（含 fileHash） |
| `createAgentWithSkills(params, skillIds)` | `lib/db/agents.ts` | 创建 Agent 并处理 Skill 关联 |
| `updateAgentWithSkills(userId, agentId, params, skillIds)` | `lib/db/agents.ts` | 更新 Agent 并处理 Skill 关联 |

**批量查询优化：**
- `getAgentsSkillsBatch` 支持分批处理（每批最多 100 条），防止 IN 子句过大
- 在 `getAgentsByUserId` 和 `getPublicAgents` 中使用静态导入，避免运行时动态导入开销

### 3.7 Agent Chat 使用模型

若 Agent 配置了 **`model_id`**，对话路由加载 **创建者** 的该条 `user_models`（见 `02模型配置说明.md`）；否则用用户默认模型或系统降级模型。

**WorkflowChat 模型解析：**
- 使用 `lib/workflowchat/model-resolver.ts` 解析模型配置
- 解析流程：modelId 有值 → 使用 modelId；modelId 为空 → 使用环境变量 `WORKFLOWCHAT_MODEL`
- API Key 和 baseURL 始终来自环境变量（`WORKFLOWCHAT_API_KEY`、`WORKFLOWCHAT_BASE_URL`）
- 支持 OpenAI-Compatible 兼容接口

---

## 4. 前端实现

### 4.1 Agent 表单 Tabs 结构

Agent 表单（`components/settings/agent-form.tsx`）使用 Tabs 组织内容，避免内容超出屏幕：

| Tab | 图标 | 内容 |
|-----|------|------|
| 基本信息 | Settings2 | 名称、描述、模板选择、模板配置 |
| 提示词 | MessageSquare | 模型选择、系统提示词 |
| 工具 | Wrench | 系统工具（沙盒环境）、MCP 工具 |
| Skill预览 | FileText | Skill 选择、预置提示词预览 |

**关键导入路径更新：**
- 系统工具相关导入来自 `lib/infra/tools/system.ts`（`getDefaultSystemTools`、`SYSTEM_TOOL_IDS`、`validateSystemToolIds`）
- 模板相关导入来自 `lib/agents/templates.ts`

### 4.2 Skill 关联联动逻辑

当选择 Skill 时，系统自动启用并锁定必要的系统工具：
- **强制启用的工具：** `system:sandbox:bash`、`system:sandbox:readFile`、`system:sandbox:writeFile`
- 被锁定的工具显示 "(Skill 必需)" 标签，禁用取消勾选

**核心函数：**
- `isToolLockedBySkill(toolId, skillIds)` - 判断工具是否因 Skill 关联而被锁定
- `getUpdatedSystemTools(currentTools, skillIds)` - 根据选择的 Skill 更新系统工具列表

### 4.3 Skill 选择器组件

`SkillSelector`（`components/settings/skill-selector.tsx`）提供：
- 从 `/api/skills` 加载用户的 Skill 列表
- 多选界面，显示 Skill 名称和描述
- `onSkillsLoaded` 回调，将加载的 Skill 信息传递给父组件

### 4.4 预置提示词预览组件

`SkillPresetPreview`（`components/settings/skill-preset-preview.tsx`）提供：
- 选择 Skill 后实时展示预置提示词预览
- 显示将注入的 Skill 列表和使用说明
- 可展开/折叠的卡片设计

### 4.5 其他前端组件

- **`app/settings/agents`**：列表、创建、编辑、公开开关、模板与工具选择。
- Agent Chat 顶栏 **`DbAgentSelector`**（`components/agent-chat/db-agent-selector.tsx`）从 `/api/agents` 拉列表并切换当前 Agent。

---

## 5. 使用指南

1. 登录后在设置中 **新建 Agent**，选择模板并填写系统提示词。
2. 可选：绑定模型与 MCP / 系统工具。
3. 可选：关联 Skill，系统将自动启用沙盒工具并生成预置提示词。
4. 需要分享给他人使用时，将 Agent 设为 **公开**。
5. 使用 API Key 访问 `/api/v1/agents` 获取可用的 Agent 列表。

---

## 6. 注意事项

1. **`template_config`** 存储为 JSON 字符串；API 响应中可能解析为对象。
2. 公开 Agent **所有人可读**，但 **只有创建者可改**。
3. Agent 绑定的 **模型属于创建者的** `user_models`，使用者无需重复配置该密钥。
4. **Skill 关联** 会强制启用 bash、readFile、writeFile 系统工具，确保 Skill 能正常运行。
5. 删除 Skill 时，`agent_skills` 中的关联记录会自动级联删除。
6. 批量查询使用静态导入优化性能，避免运行时动态导入开销。
7. **Schema 来源变更：** 数据库表结构定义已从 `lib/db/schema.ts` 拆分至 `lib/schemas/agent.ts`（Agent 相关）和 `lib/schemas/tool.ts`（Skill/MCP/工具相关）。旧路径 `lib/db/schema.ts` 仍保留为兼容层，统一 re-export 自 `@/lib/schemas`。
8. **公开 Agent 类型：** 新增 `PublicAgentWithCreator` 类型，在 `AgentWithTools` 基础上扩展了 `creator` 字段（含 `id`、`username`），用于对外 API 返回创建者信息。
9. **MCP 运行时架构重构：**
   - `lib/agents/mcp-runtime.ts` 现为适配器层，负责桥接外部配置
   - MCP 运行时核心实现在 `lib/infra/mcp/runtime.ts`（服务器连接、工具发现、执行）
   - 接口定义在 `lib/infra/mcp/interface.ts`
10. **Agent 运行时创建迁移：** 运行时创建逻辑已迁移到 `lib/agent-chat/runtime.ts`，提供 `createRuntime` 和 `executeAgent` 函数。
11. **系统工具定义迁移：** 系统工具 ID 常量、校验函数已迁移到 `lib/infra/tools/system.ts`，前端组件需从该路径导入。
12. **沙盒工具实现位置：** 沙盒工具（bash、readFile、writeFile）实现在 `lib/infra/sandbox/*.ts`，通过 `lib/infra/tools/sandbox.ts` 注册到全局工具注册表。
13. **Skills 服务层：** Skill 加载、执行、工具创建逻辑在 `lib/infra/skills/skill-service.ts`，提供批量加载和工具创建能力。
14. **Agent 配置加载：** `lib/agent-chat/agent-loader.ts` 负责从数据库加载 Agent 配置并解析运行时参数（maxSteps、customInstructions），支持 userId 校验和 skills 关联获取。
15. **Agent 工具创建：** `lib/workflowchat/agent-tools.ts` 将工具创建逻辑独立，避免循环依赖，在 step 函数内部调用，避免 Zod schema 经过 workflow 序列化。

---

## 7. 相关文件清单

### 7.1 API 路层

| 路径 | 说明 |
|------|------|
| `app/api/agents/route.ts` | 列表、创建（含 Skill 关联） |
| `app/api/agents/[id]/route.ts` | 详情、更新、删除 |
| `app/api/agents/[id]/publish/route.ts` | 公开切换 |
| `app/api/v1/agents/route.ts` | 对外 API（API Key 认证） |

### 7.2 数据访问层

| 路径 | 说明 |
|------|------|
| `lib/db/agents.ts` | Agent 持久化、查询、Skill 关联处理 |
| `lib/db/skills.ts` | Skill CRUD、Agent-Skill 关联操作 |
| `lib/schemas/agent.ts` | Agent 表结构定义与类型（Agent、AgentWithTools、PublicAgentWithCreator 等） |
| `lib/schemas/tool.ts` | Skill/MCP/工具表结构定义与类型（UserSkill、AgentSkill、McpTool 等） |

### 7.3 Agent 模块（lib/agents/）

| 路径 | 说明 |
|------|------|
| `lib/agents/index.ts` | Agent 模块统一导出（模板、MCP 运行时工具构建、工具集合合并） |
| `lib/agents/templates.ts` | 模板定义与校验（validateTemplateConfig） |
| `lib/agents/mcp-runtime.ts` | MCP 运行时适配器（桥接外部配置，调用 `lib/infra/mcp/runtime.ts`） |
| `lib/agents/toolset-merge.ts` | 工具集合合并（mergeAgentToolSets） |

### 7.4 基础设施层（lib/infra/）

#### MCP 运行时（lib/infra/mcp/）

| 路径 | 说明 |
|------|------|
| `lib/infra/mcp/index.ts` | MCP 模块统一导出 |
| `lib/infra/mcp/interface.ts` | MCP 运行时接口定义（McpRuntimeInterface、配置类型） |
| `lib/infra/mcp/runtime.ts` | MCP 运行时核心实现（服务器连接、工具发现、执行） |

#### 工具注册（lib/infra/tools/）

| 路径 | 说明 |
|------|------|
| `lib/infra/tools/index.ts` | 工具模块统一导出 |
| `lib/infra/tools/registry.ts` | 全局工具注册表（注册、获取、创建、注销） |
| `lib/infra/tools/system.ts` | 系统工具定义（SYSTEM_TOOL_IDS、校验、序列化） |
| `lib/infra/tools/sandbox.ts` | 沙盒工具注册（bash、readFile、writeFile） |
| `lib/infra/tools/init.ts` | 工具初始化（批量注册系统工具） |
| `lib/infra/tools/service.ts` | 工具服务层 |
| `lib/infra/tools/types.ts` | 工具类型定义 |

#### 沙盒环境（lib/infra/sandbox/）

| 路径 | 说明 |
|------|------|
| `lib/infra/sandbox/index.ts` | 沙盒模块统一导出 |
| `lib/infra/sandbox/config.ts` | 沙盒配置（路径限制、环境变量） |
| `lib/infra/sandbox/factory.ts` | 沙盒工具工厂函数 |
| `lib/infra/sandbox/tools.ts` | 沙盒工具实现（bash、readFile、writeFile） |
| `lib/infra/sandbox/interface.ts` | 沙盒接口定义 |
| `lib/infra/sandbox/path-validator.ts` | 路径验证器（安全校验） |
| `lib/infra/sandbox/session-manager.ts` | 会话管理器 |
| `lib/infra/sandbox/skill-loader.ts` | Skill 加载器（沙盒环境内） |
| `lib/infra/sandbox/types.ts` | 沙盒类型定义 |

#### Skills 服务（lib/infra/skills/）

| 路径 | 说明 |
|------|------|
| `lib/infra/skills/index.ts` | Skills 模块统一导出 |
| `lib/infra/skills/core-types.ts` | Skill 核心类型定义 |
| `lib/infra/skills/skill-service.ts` | Skill 服务层（加载、执行、工具创建） |
| `lib/infra/skills/skill-tool.ts` | Skill 工具定义和创建 |
| `lib/infra/skills/loader.ts` | Skill 加载器 |
| `lib/infra/skills/discovery.ts` | Skill 发现模块 |
| `lib/infra/skills/validator.ts` | Skill 验证器 |
| `lib/infra/skills/types.ts` | Skill 类型定义 |

### 7.5 Agent Chat 模块（lib/agent-chat/）

| 路径 | 说明 |
|------|------|
| `lib/agent-chat/index.ts` | Agent Chat 模块统一导出 |
| `lib/agent-chat/runtime.ts` | Agent 运行时创建（createRuntime、executeAgent） |
| `lib/agent-chat/agent-loader.ts` | Agent 配置加载（从数据库加载配置并解析参数） |
| `lib/agent-chat/model-resolver.ts` | 模型解析器（解析 Agent Chat 模型配置） |
| `lib/agent-chat/auth-context.ts` | 认证上下文获取 |
| `lib/agent-chat/conversation.ts` | 会话管理（确保会话、加载历史、保存消息） |
| `lib/agent-chat/request.ts` | 请求解析 |
| `lib/agent-chat/response.ts` | 响应构建（流式响应） |
| `lib/agent-chat/types.ts` | Agent Chat 类型定义 |
| `lib/agent-chat/utils.ts` | 工具函数 |

### 7.6 WorkflowChat 模块（lib/workflowchat/）

| 路径 | 说明 |
|------|------|
| `lib/workflowchat/agent.ts` | Agent 定义（ToolLoopAgent 工厂函数、系统提示词构建） |
| `lib/workflowchat/agent-tools.ts` | Agent 工具创建（根据配置创建完整的工具集合） |
| `lib/workflowchat/agent-loader.ts` | Agent 配置加载器（兼容层） |
| `lib/workflowchat/model-resolver.ts` | 模型解析器（WorkflowChat 模型配置） |
| `lib/workflowchat/constants.ts` | WorkflowChat 常量定义 |
| `lib/workflowchat/service.ts` | WorkflowChat 服务层（会话管理、消息处理） |
| `lib/workflowchat/repository.ts` | WorkflowChat 数据访问层 |
| `lib/workflowchat/dto.ts` | WorkflowChat 数据传输对象 |

### 7.7 前端组件

| 路径 | 说明 |
|------|------|
| `components/settings/agent-form.tsx` | Agent 表单（Tabs 结构，导入路径已更新） |
| `components/settings/skill-selector.tsx` | Skill 选择器组件 |
| `components/settings/skill-preset-preview.tsx` | Skill 预置提示词预览组件 |
| `app/settings/agents/**` | 设置 UI |

**创建时间：** 2026-03-28
**版本：** v1.4
**最后更新：** 2026-05-01