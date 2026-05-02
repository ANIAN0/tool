# WorkflowChat 页面说明

> **文档目的：** 记录 WorkflowChat 功能的完整实现，包括前端页面、后端服务、Workflow 编排、Agent 模块和 Debug 子系统。本文档面向开发团队，帮助快速理解和维护该功能模块。

---

## 目录

- [1. 系统概述](#1-系统概述)
- [2. 技术栈](#2-技术栈)
- [3. 系统架构](#3-系统架构)
  - [3.1 整体架构图](#31-整体架构图)
  - [3.2 核心流程](#32-核心流程)
- [4. 数据库设计](#4-数据库设计)
  - [4.1 表结构](#41-表结构)
  - [4.2 索引设计](#42-索引设计)
- [5. 后端实现](#5-后端实现)
  - [5.1 服务层 (service.ts)](#51-服务层-servicets)
  - [5.2 数据访问层 (repository.ts)](#52-数据访问层-repositoryts)
  - [5.3 Agent 模块](#53-agent-模块)
  - [5.4 Workflow 编排](#54-workflow-编排)
  - [5.5 API 路由](#55-api-路由)
- [6. 前端实现](#6-前端实现)
  - [6.1 会话列表页](#61-会话列表页)
  - [6.2 聊天详情页](#62-聊天详情页)
  - [6.3 Agent 选择器组件](#63-agent-选择器组件)
- [7. Debug 子系统](#7-debug-子系统)
  - [7.1 调试页面功能](#71-调试页面功能)
  - [7.2 调试服务层](#72-调试服务层)
- [8. 使用指南](#8-使用指南)
- [9. 注意事项](#9-注意事项)
- [10. 相关文件清单](#10-相关文件清单)
- [11. 创建时间](#11-创建时间)

---

## 1. 系统概述

WorkflowChat 是一个基于 Workflow 驱动的多轮对话系统，与传统的 Chat 系统不同，它通过 Workflow 引擎来编排和执行 Agent 的推理过程，支持：

- **Agent 选择：** 用户创建会话时可选择不同的 Agent（支持用户私有 Agent 和公开 Agent）
- **多轮对话：** 基于 AI SDK 的 `useChat` hook 实现流式多轮对话
- **Workflow 编排：** 通过 Vercel Workflow SDK 编排 Agent 推理流程，支持 step 级别的状态管理
- **流式响应：** 支持 SSE 流式输出，页面刷新后可重连活跃 stream
- **CAS 并发控制：** 通过 CAS (Compare-And-Swap) 机制确保同一会话只有一个活跃的推理流
- **Token 统计：** 记录每个 run 和 step 的 Token 使用情况
- **调试支持：** 提供独立的调试页面，可查看 run 详情、step 时间线、events 和 streams

---

## 2. 技术栈

| 类别 | 技术/框架 |
|------|-----------|
| 前端框架 | Next.js 15 (App Router) |
| UI 组件库 | shadcn/ui (Radix UI) |
| AI SDK | Vercel AI SDK v4 |
| Workflow 引擎 | Vercel Workflow SDK (`workflow` 包) |
| 数据库 | SQLite (通过 @libsql/client) |
| 认证 | JWT Token |
| 状态管理 | React Hooks (useState, useRef, useCallback) |
| 样式方案 | Tailwind CSS |

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           前端层 (Client)                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ 会话列表页   │  │  聊天详情页       │  │  调试页面             │  │
│  │ page.tsx     │  │  [id]/page.tsx   │  │  debug/page.tsx       │  │
│  └──────┬───────┘  └────────┬─────────┘  └───────────┬───────────┘  │
│         │                   │                        │              │
│         └───────────────────┼────────────────────────┘              │
│                             │                                       │
│                    ┌────────▼─────────┐                             │
│                    │ useChat Hook     │                             │
│                    │ (AI SDK)         │                             │
│                    └────────┬─────────┘                             │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTP/SSE
┌─────────────────────────────┼───────────────────────────────────────┐
│                      API 路由层 (Server)                            │
├─────────────────────────────┼───────────────────────────────────────┤
│                    ┌────────▼─────────┐                             │
│                    │ conversations/*  │                             │
│                    │ messages/route   │                             │
│                    │ debug/runs/*     │                             │
│                    └────────┬─────────┘                             │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                       服务层 (Service)                               │
├─────────────────────────────┼───────────────────────────────────────┤
│                    ┌────────▼─────────┐                             │
│                    │ service.ts       │                             │
│                    │ - sendMessage    │                             │
│                    │ - createConv...  │                             │
│                    │ - reconcile...   │                             │
│                    └────────┬─────────┘                             │
│                             │                                       │
│         ┌───────────────────┼───────────────────┐                   │
│         │                   │                   │                   │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌───────▼──────┐           │
│  │ repository  │    │ agent.ts    │    │ agent-loader │           │
│  │ (数据库)    │    │ (Agent)     │    │ (配置加载)   │           │
│  └─────────────┘    └──────┬──────┘    └──────────────┘           │
│                            │                                       │
└────────────────────────────┼────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                  Workflow 编排层                                     │
├────────────────────────────┼────────────────────────────────────────┤
│                   ┌────────▼─────────┐                              │
│                   │ workflowchat.ts  │                              │
│                   │ (主 Workflow)    │                              │
│                   └────────┬─────────┘                              │
│                            │                                        │
│    ┌───────────────────────┼───────────────────────┐                │
│    │                       │                       │                │
│ ┌──▼────────┐    ┌────────▼────────┐    ┌────────▼──────────┐     │
│ │ createModel│    │ claimActive...  │    │ runAgentStep      │     │
│ │ Step       │    │ (CAS)           │    │ (ToolLoopAgent)   │     │
│ └────────────┘    └─────────────────┘    └───────────────────┘     │
│                                                                    │
│                   ┌─────────────────┐                              │
│                   │ workflowchat-   │                              │
│                   │ post-finish.ts  │                              │
│                   │ (后处理)        │                              │
│                   └─────────────────┘                              │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心流程

**发送消息完整流程：**

1. 用户在聊天详情页输入消息
2. 前端调用 `POST /api/workflowchat/conversations/:id/messages`
3. API 路由验证 JWT Token 和会话权限
4. 调用 `sendMessage()` 服务函数：
   - 加载 Agent 配置（agent-loader）
   - 校验 agentId 与会话绑定的 agentId 一致
   - 写入 user message 到数据库
   - 创建 run 记录（status=pending）
   - reconcile stale activeStreamId
   - 启动 workflow（workflowchatReplyWorkflow）
   - CAS claim active_stream_id
   - 回填 workflow_run_id 到 run 记录
5. 返回流式响应给前端
6. Workflow 内部执行：
   - createModelStep：创建语言模型
   - claimActiveStream：幂等 claim
   - runAgentStep：执行 Agent 推理，流式写入
   - finalizeRun：更新 run 状态
   - triggerPostFinish：触发后处理 workflow
7. Post-finish Workflow 执行：
   - persistAssistantMessage：持久化 assistant 消息
   - persistRunResult：更新 run 状态
   - persistRunSteps：批量写入 step 数据
   - clearActiveStream：CAS 清除 active_stream_id
   - recordWorkflowUsage：汇总 Token 统计

---

## 4. 数据库设计

### 4.1 表结构

#### workflowchat_conversations 表

存储 WorkflowChat 会话信息。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT (PK) | 会话唯一标识 |
| user_id | TEXT | 用户 ID，可为空（首版不强制登录） |
| agent_id | TEXT (NOT NULL) | 关联的 Agent ID，创建时绑定 |
| title | TEXT | 会话标题 |
| status | TEXT | 状态：active / archived |
| active_stream_id | TEXT | 当前活跃的 workflow runId，用于 CAS 抢占 |
| last_message_at | INTEGER | 最后消息时间戳 |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

#### workflowchat_messages 表

存储聊天消息。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT (PK) | 消息唯一标识 |
| conversation_id | TEXT (FK) | 关联的会话 ID |
| run_id | TEXT (FK) | 关联的 run ID，可为空 |
| role | TEXT | 消息角色：user / assistant / system |
| parts | TEXT | AI SDK UIMessage parts 格式 (JSON) |
| created_at | INTEGER | 创建时间戳 |

#### workflowchat_runs 表

记录每一轮 workflow 执行的完整生命周期。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT (PK) | Run 唯一标识 |
| conversation_id | TEXT (FK) | 关联的会话 ID |
| workflow_run_id | TEXT | World 侧的 runId，非空时唯一 |
| workflow_name | TEXT | Workflow 名称 |
| model_id | TEXT | 模型 ID |
| request_message_id | TEXT | 请求消息 ID |
| response_message_id | TEXT | 响应消息 ID，可为空 |
| status | TEXT | 状态：pending / running / completed / failed |
| error_json | TEXT | 错误信息 JSON |
| started_at | INTEGER | 开始时间戳 |
| finished_at | INTEGER | 结束时间戳 |
| total_duration_ms | INTEGER | 总耗时（毫秒） |
| prompt_tokens | INTEGER | Prompt Token 数量 |
| completion_tokens | INTEGER | Completion Token 数量 |
| total_tokens | INTEGER | 总 Token 数量 |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

#### workflowchat_run_steps 表

记录 workflow run 中每个 step 的执行详情。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT (PK) | Step 唯一标识 |
| workflow_run_id | TEXT (FK) | 关联的 workflow run ID |
| step_number | INTEGER | Step 序号 |
| step_name | TEXT | Step 名称 |
| status | TEXT | 状态：pending / running / completed / failed |
| started_at | INTEGER | 开始时间戳 |
| finished_at | INTEGER | 结束时间戳 |
| duration_ms | INTEGER | 耗时（毫秒） |
| finish_reason | TEXT | 完成原因 |
| prompt_tokens | INTEGER | Prompt Token 数量 |
| completion_tokens | INTEGER | Completion Token 数量 |
| total_tokens | INTEGER | 总 Token 数量 |
| created_at | INTEGER | 创建时间戳 |

### 4.2 索引设计

```sql
-- 会话相关索引
CREATE INDEX idx_wfchat_conv_updated_at ON workflowchat_conversations(updated_at DESC);
CREATE INDEX idx_wfchat_conv_user_id ON workflowchat_conversations(user_id);
CREATE INDEX idx_wfchat_conv_agent_id ON workflowchat_conversations(agent_id);

-- 消息相关索引
CREATE INDEX idx_wfchat_msg_conv_created ON workflowchat_messages(conversation_id, created_at ASC);
CREATE INDEX idx_wfchat_msg_run_id ON workflowchat_messages(run_id);

-- Run 相关索引
CREATE INDEX idx_wfchat_run_conv_created ON workflowchat_runs(conversation_id, created_at DESC);
CREATE UNIQUE INDEX idx_wfchat_run_workflow_run_id ON workflowchat_runs(workflow_run_id) WHERE workflow_run_id IS NOT NULL;
CREATE INDEX idx_wfchat_run_conv_status ON workflowchat_runs(conversation_id, status);

-- Step 相关索引
CREATE UNIQUE INDEX idx_wfchat_step_run_number ON workflowchat_run_steps(workflow_run_id, step_number ASC);
```

---

## 5. 后端实现

### 5.1 服务层 (service.ts)

服务层封装了会话管理、消息处理、run 创建、active stream 协调等业务逻辑。

**核心函数：**

#### `sendMessage()`

发送消息的完整流程：

```typescript
async function sendMessage(
  conversationId: string,
  agentId: string,
  userId: string | null,
  content: string,
  modelId?: string,
): Promise<{ runDTO: RunDTO; workflowRun: Run<unknown> }>
```

**流程：**
1. 验证用户身份（必须登录）
2. 加载 Agent 配置（loadAgentConfig）
3. 校验 agentId 与会话绑定的 agentId 一致
4. 写入 user message
5. 创建 run 记录（status=pending）
6. reconcileExistingActiveStream：检查 active_stream_id 是否有 stale 残留
7. 如果有活跃 run，标记新 run 为 failed 并抛出冲突错误
8. 组装 workflow 输入参数
9. 启动 workflow
10. CAS claim active_stream_id
11. 如果 CAS 失败，取消 workflow 并抛出冲突错误
12. 回填 workflow_run_id 到 run 记录

**自定义错误类型：**

- `SendMessageAgentConfigError`：Agent 配置加载失败
- `SendMessageAgentMismatchError`：agentId 与会话绑定的 agentId 不一致
- `SendMessageConflictError`：CAS claim 失败或已有活跃 run
- `SendMessageConfigError`：环境变量缺失

#### `reconcileExistingActiveStream()`

清理 stale activeStreamId：

```typescript
async function reconcileExistingActiveStream(
  conversationId: string,
): Promise<RunDTO | null>
```

检查会话的 active_stream_id：
- 如果为空，直接返回
- 查找对应的 run，如果 run 已终态，CAS 清除并返回
- 如果 run 仍在运行，返回 run 信息
- 如果找不到对应 run 记录，CAS 清除残留

#### `getActiveStreamRun()`

获取活跃 stream 的重连句柄：

```typescript
async function getActiveStreamRun(
  conversationId: string,
): Promise<Run<unknown> | null>
```

### 5.2 数据访问层 (repository.ts)

Repository 层封装了所有数据库操作，使用 @libsql/client 访问 SQLite。

**CAS 操作：**

#### `claimChatActiveStreamId()`

幂等 claim active_stream_id：

```typescript
async function claimChatActiveStreamId(
  chatId: string,
  workflowRunId: string
): Promise<boolean>
```

使用 `UPDATE ... WHERE ... RETURNING` 判断 CAS 是否成功：
- slot 为空或已被自己占用时成功
- slot 被他人占用时返回 false

#### `compareAndSetActiveStreamId()`

严格 CAS：

```typescript
async function compareAndSetActiveStreamId(
  chatId: string,
  expectedStreamId: string | null,
  nextStreamId: string | null
): Promise<boolean>
```

仅当 active_stream_id 等于 expectedStreamId 时更新为 nextStreamId。

### 5.3 Agent 模块

#### agent.ts - Agent 定义

导出 ToolLoopAgent 工厂函数、系统提示词构建、工具集创建。

```typescript
export function createWorkflowChatAgent(options?: {
  model?: LanguageModel;
  maxSteps?: number;
  customInstructions?: string;
  tools?: ToolSet;
}): ToolLoopAgent
```

- 支持外部传入模型、工具和运行时参数
- 使用 `stepCountIs(maxSteps)` 动态步数控制
- 默认最大执行步数：50

#### agent-loader.ts - Agent 配置加载器

负责从数据库加载 Agent 配置并解析运行时参数。

```typescript
export async function loadAgentConfig(
  userId: string,
  agentId: string
): Promise<LoadAgentConfigResult>
```

**权限规则：**
- 公开 Agent：所有人可用
- 私有 Agent：仅创建者可用

**返回的 AgentConfig 包含：**
- Agent 基本信息（id, name, systemPrompt, modelId）
- 运行时配置（maxSteps, customInstructions）
- 工具配置列表（tools）
- Skill 配置列表（skills）

#### agent-tools.ts - Agent 工具创建

将工具创建逻辑独立，避免循环依赖。

```typescript
export async function createAgentTools(
  agentConfig: AgentConfig,
  userId: string,
  conversationId: string,
): Promise<ToolSet>
```

**设计目标：**
- 在 step 函数内部调用，避免 Zod schema 经过 workflow 序列化
- 集中管理工具初始化和创建逻辑
- 包含系统工具和 Skill 工具

### 5.4 Workflow 编排

#### workflowchat.ts - 主回复 Workflow

编排流程：
1. **createModelStep** — 使用 ModelService 创建语言模型
2. **claimActiveStream** — 幂等 claim active_stream_id（双保障）
3. **runAgentStep** — 执行 ToolLoopAgent 流式推理
4. **finalizeRun** — 同步更新 run 状态
5. **triggerPostFinish** — 触发 post-finish 后处理

```typescript
export async function workflowchatReplyWorkflow(input: WorkflowChatRunInput) {
  "use workflow";
  // ...
}
```

**重要设计决策：**
- 所有依赖 @libsql/client 的 DB 操作必须在 step 函数中执行
- 工具在 runAgentStep 内部创建，避免 Zod schema 经过 workflow 序列化
- Step timings 在内存中累积，传给 post-finish

#### workflowchat-post-finish.ts - 后处理 Workflow

主 workflow 完成后的后处理流程：

1. **persistAssistantMessage** — 将 assistant 消息落库
2. **persistRunResult** — 更新 run 状态为 completed/failed
3. **persistRunSteps** — 批量写入 step 耗时数据
4. **clearActiveStream** — CAS 清除，带重试（最多 3 次，每次间隔 50ms）
5. **recordWorkflowUsage** — 汇总并持久化 token 统计

### 5.5 API 路由

#### `GET /api/workflowchat/conversations`

获取当前用户的会话列表。

- 认证：JWT 鉴权
- 返回：用户的所有会话，按更新时间降序排序

#### `POST /api/workflowchat/conversations`

创建新会话。

- 请求体：`{ "agentId": "必填AgentID", "title": "可选标题" }`
- 返回：新创建的会话信息

#### `GET /api/workflowchat/conversations/:id`

获取会话详情（含消息历史和 activeStreamId）。

#### `POST /api/workflowchat/conversations/:id/messages`

发送消息并启动 workflow。

- 请求体：`{ "agentId": "必填", "content": "消息内容", "modelId": "可选模型ID" }`
- 返回：流式响应（SSE）
- 响应头：`x-workflow-run-id`

**异常场景处理：**
- 权限校验失败 → 403
- agentId 不匹配 → 400
- 已有 active run 且仍在运行 → 返回已有 stream 重连
- CAS claim 失败 → 409
- start(...) 失败 → 500
- 环境变量缺失 → 500

#### `GET /api/workflowchat/conversations/:id/runs/:runId/stream`

重连活跃 stream（用于页面刷新恢复）。

---

## 6. 前端实现

### 6.1 会话列表页

**文件：** `app/workflowchat/page.tsx` + `app/workflowchat/_components/workflow-chat-list-client.tsx`

**架构：**
- Server Component：验证登录状态
- Client Component：实际的页面交互逻辑

**功能：**
- 显示用户的所有会话列表
- 创建新会话（需先选择 Agent）
- 显示会话关联的 Agent 信息
- 跳转到聊天详情页

**关键实现：**
- 使用 `authenticatedFetch` 携带 JWT Token 调用 API
- 集成 `AgentSelector` 组件选择 Agent
- 使用 `useAgents` hook 获取 Agent 列表（用于显示 Agent 名称）

### 6.2 聊天详情页

**文件：** `app/workflowchat/[id]/page.tsx` + `app/workflowchat/_components/workflow-chat-client.tsx`

**架构：**
- Server Component：验证登录状态，解析路由参数
- Client Component：聊天交互逻辑

**功能：**
- 加载历史消息
- 发送消息并接收流式回复
- 页面刷新后重连活跃 stream
- 自动滚动到底部

**关键实现：**

#### useChat Hook 配置

```typescript
const { messages, sendMessage, status, setMessages, resumeStream } = useChat({
  transport,
  id: conversationId,
});
```

#### DefaultChatTransport 配置

```typescript
const transport = new DefaultChatTransport({
  api: `/api/workflowchat/conversations/${conversationId}/messages`,
  prepareSendMessagesRequest({ messages, headers: baseHeaders }) {
    // 将 useChat 最后一条消息转为后端期望的 { agentId, content, modelId } 格式
    // 从 localStorage 读取 JWT token
  },
  prepareReconnectToStreamRequest({ id, headers: baseHeaders }) {
    // 根据 activeStreamId 构造 stream 重连 URL
  },
});
```

#### 页面刷新恢复

```typescript
useEffect(() => {
  // 加载历史消息
  // 如果有 activeStreamId，调用 resumeStream() 重连
}, [conversationId]);
```

### 6.3 Agent 选择器组件

**文件：** `components/workflowchat/agent-selector.tsx`

**功能：**
- 从 API 获取用户的 Agent 列表和公开 Agent
- 提供下拉选择器，支持分组显示（我的 Agent / 公开 Agent）
- 显示 Agent 名称和简要信息

**导出：**
- `AgentSelector`：选择器组件
- `useAgents`：获取 Agent 列表的 hook
- `AgentInfo`：Agent 信息类型
- `AgentSelectorProps`：组件 Props 类型

---

## 7. Debug 子系统

### 7.1 调试页面功能

**文件：** `app/workflowchat/debug/page.tsx`

**功能：**
- **Runs 列表：** 显示所有 workflow run，支持状态筛选和分页
- **Run 详情：** 显示 run 的基本信息、错误信息、消息映射、输入/输出摘要
- **Steps 时间线：** 可视化展示每个 step 的执行顺序、状态、耗时
- **Streams/Events 面板：** 查看 workflow 的 events 列表和 stream 内容

**组件结构：**
- `RunsList`：左侧 Runs 列表面板
- `RunOverview`：Run 概览组件
- `StepTimeline`：Steps 时间线组件
- `StreamsEventsPanel`：Streams/Events 面板组件

### 7.2 调试服务层

**文件：** `lib/workflowchat/debug/service.ts`

**核心函数：**

#### `listDebugRuns()`

获取 runs 列表，支持游标分页。

```typescript
async function listDebugRuns(filters: DebugRunListFilters = {}): Promise<DebugRunListResponse>
```

- 支持 status、conversationId 筛选
- 使用游标分页（base64url 编码的 createdAt:id）

#### `getDebugRunDetail()`

获取 run 详情，整合业务库数据和 World SDK 数据。

```typescript
async function getDebugRunDetail(runIdOrWorkflowRunId: string): Promise<DebugRunDetailDTO | null>
```

- 支持按 id 或 workflow_run_id 查询
- 获取请求/响应消息
- 从 World SDK 获取 hydrated input/output、steps、status、error

#### `getDebugRunEvents()`

获取 workflow events 列表。

#### `getDebugRunStream()`

获取 workflow stream 内容。

---

## 8. 使用指南

### 创建会话

1. 访问 `/workflowchat` 页面
2. 在顶部选择 Agent（下拉选择器）
3. 点击"新建会话"按钮
4. 跳转到聊天详情页

### 发送消息

1. 在聊天详情页输入消息
2. 点击"发送"按钮或按 Enter
3. 等待流式回复完成

### 页面刷新恢复

如果在流式回复过程中刷新页面：
1. 页面会自动加载历史消息
2. 检测到活跃的 stream 后自动重连
3. 继续接收流式回复

### 调试 Workflow

1. 访问 `/workflowchat/debug` 页面
2. 在左侧选择 run 查看详情
3. 切换"概览"、"Steps 时间线"、"Streams/Events"标签页查看不同信息

---

## 9. 注意事项

### 环境变量配置

使用 WorkflowChat 功能需要配置以下环境变量：

```env
WORKFLOWCHAT_API_KEY=your-api-key
WORKFLOWCHAT_BASE_URL=https://api.openai.com/v1  # 可选，默认 OpenAI
WORKFLOWCHAT_MODEL=gpt-4.1-mini  # 可选，默认模型
```

### Agent 配置

- 创建会话时必须选择 Agent
- Agent 的 agentId 在会话创建时绑定，后续不可更改
- 发送消息时传入的 agentId 必须与会话绑定的 agentId 一致

### 并发控制

- 同一会话同一时间只能有一个活跃的推理流
- 通过 CAS 机制保证并发安全
- 如果发送消息时已有活跃 run，会返回已有 stream 的重连响应

### Workflow Sandbox 限制

- 所有依赖 @libsql/client 的 DB 操作必须在 step 函数中执行
- workflow 函数运行在 VM sandbox 中，require 不可用
- 工具在 step 函数内部创建，避免 Zod schema 经过 workflow 序列化

### Token 统计

- Token 统计数据会在 post-finish workflow 中异步写入
- 包含 prompt_tokens、completion_tokens、total_tokens
- 支持 run 级别和 step 级别的统计

---

## 10. 相关文件清单

| 类别 | 文件路径 | 说明 |
|------|----------|------|
| **前端页面** | `app/workflowchat/page.tsx` | 会话列表页 (Server Component) |
| | `app/workflowchat/[id]/page.tsx` | 聊天详情页 (Server Component) |
| | `app/workflowchat/debug/page.tsx` | 调试页面 |
| | `app/workflowchat/poc/page.tsx` | POC 验证页面 |
| **前端组件** | `app/workflowchat/_components/workflow-chat-client.tsx` | 聊天详情客户端组件 |
| | `app/workflowchat/_components/workflow-chat-list-client.tsx` | 会话列表客户端组件 |
| | `components/workflowchat/agent-selector.tsx` | Agent 选择器组件 |
| | `components/workflowchat/index.ts` | 组件导出入口 |
| **后端服务** | `lib/workflowchat/service.ts` | 服务层核心逻辑 |
| | `lib/workflowchat/repository.ts` | 数据访问层 |
| | `lib/workflowchat/dto.ts` | DTO 类型定义 |
| | `lib/workflowchat/constants.ts` | 常量定义 |
| **Agent 模块** | `lib/workflowchat/agent.ts` | Agent 定义和工厂函数 |
| | `lib/workflowchat/agent-loader.ts` | Agent 配置加载器 |
| | `lib/workflowchat/agent-tools.ts` | Agent 工具创建 |
| | `lib/workflowchat/model-resolver.ts` | 模型解析器 |
| **Workflow 编排** | `app/workflows/workflowchat.ts` | 主回复 Workflow |
| | `app/workflows/workflowchat-post-finish.ts` | 后处理 Workflow |
| | `app/workflows/workflowchat-poc.ts` | POC 验证 Workflow |
| **API 路由** | `app/api/workflowchat/conversations/route.ts` | 会话列表和创建 |
| | `app/api/workflowchat/conversations/[id]/route.ts` | 会话详情 |
| | `app/api/workflowchat/conversations/[id]/messages/route.ts` | 发送消息 |
| | `app/api/workflowchat/conversations/[id]/runs/[runId]/route.ts` | Run 详情 |
| | `app/api/workflowchat/conversations/[id]/runs/[runId]/stream/route.ts` | Stream 重连 |
| | `app/api/workflowchat/conversations/[id]/runs/[runId]/cancel/route.ts` | 取消 Run |
| | `app/api/workflowchat/poc/route.ts` | POC 验证 API |
| | `app/api/workflowchat/debug/runs/route.ts` | Debug runs 列表 |
| | `app/api/workflowchat/debug/runs/[runId]/route.ts` | Debug run 详情 |
| | `app/api/workflowchat/debug/runs/[runId]/events/route.ts` | Debug events |
| | `app/api/workflowchat/debug/runs/[runId]/streams/[streamName]/route.ts` | Debug streams |
| **Debug 子系统** | `lib/workflowchat/debug/dto.ts` | Debug DTO 类型定义 |
| | `lib/workflowchat/debug/service.ts` | Debug 服务层 |
| | `lib/workflowchat/debug/hydrate.ts` | 数据水合工具 |
| | `lib/workflowchat/debug/world.ts` | World SDK 集成 |
| | `lib/workflowchat/debug/index.ts` | 统一导出 |
| **Schema** | `lib/schemas/workflowchat.ts` | 数据库表结构和类型定义 |

---

## 11. 创建时间

- **文档创建时间：** 2026-04-30
- **基于代码版本：** dev/agent-chat-refactor 分支
- **最后更新：** 2026-05-01
