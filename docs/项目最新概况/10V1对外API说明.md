# V1 对外 API 说明

> 本文档记录 V1 对外 API 的完整实现，供外部程序通过 API Key 调用对话、Agent、Skill 等功能。

## 系统概述

### V1 API 设计目标

V1 API 是对外公开的接口层，设计目标如下：

1. **安全鉴权**：通过 API Key 进行身份验证，不依赖 JWT Session
2. **独立访问**：与内部 API 完全隔离，便于外部程序集成
3. **流式响应**：支持 SSE 流式对话，适配 AI 场景
4. **资源隔离**：API 创建的会话独立管理（source: "api-v1"）
5. **速率限制**：内置防护机制，防止滥用

### 与内部 API 的区别

| 特性 | V1 对外 API | 内部 API |
|------|-------------|----------|
| 认证方式 | API Key（Bearer Token） | JWT Session + 匿名ID |
| 会话标识 | source: "api-v1" | source: "web" |
| 适用场景 | 外部程序调用 | 前端页面调用 |
| 响应格式 | 标准 JSON + 流式 SSE | 页面适配格式 |

## 技术栈

- **框架**：Next.js API Routes
- **认证**：API Key（SHA-256 哈希验证）
- **流式响应**：AI SDK UIMessageStreamResponse + ToolLoopAgent
- **速率限制**：自定义 Rate Limiter
- **数据存储**：Supabase（PostgreSQL + Storage）
- **模型服务**：ModelService（lib/infra/model，统一模型创建入口）
- **会话服务**：SessionService / ChatSessionService（lib/infra/session，会话 CRUD + token 汇总 + 压缩缓存）
- **消息服务**：MessageService（lib/infra/message，消息 CRUD）
- **MCP 运行时**：McpRuntime（lib/infra/mcp，接口抽象 + 尽力模式 + 诊断信息）
- **沙盒工厂**：SandboxFactory（lib/infra/sandbox，工厂模式创建沙盒实例，支持 mock 测试）
- **工具合并**：mergeAgentToolSets（系统工具优先，MCP 工具补充）
- **Schema 管理**：schemas/ 统一目录（从 lib/db/schema.ts 迁移）

## 目录

- [系统架构](#系统架构)
- [认证机制](#认证机制)
- [API端点说明](#api端点说明)
  - [POST /api/v1/chat](#post-apiv1chat-流式对话)
  - [GET/POST /api/v1/conversations](#getpost-apiv1conversations-会话管理)
  - [GET/DELETE /api/v1/conversations/[id]](#getdelete-apiv1conversationsid-会话详情)
  - [GET /api/v1/conversations/[id]/messages](#get-apiv1conversationsidmessages-消息列表)
  - [GET /api/v1/agents](#get-apiv1agents-agent列表)
  - [GET /api/v1/skills](#get-apiv1skills-skill列表)
  - [PUT /api/v1/skills/[id]](#put-apiv1skillsid-skill更新)
- [请求/响应格式](#请求响应格式)
- [使用指南](#使用指南)
- [注意事项](#注意事项)
- [相关文件清单](#相关文件清单)

## 系统架构

```
外部程序
    │
    ▼ Authorization: Bearer sk_live_xxx
┌───────────────────────────────────────┐
│           API Gateway Layer           │
│  ┌─────────────────────────────────┐  │
│  │   lib/infra/user/api-key        │  │
│  │   - 提取 API Key                 │  │
│  │   - SHA-256 哈希验证             │  │
│  │   - 速率限制检查                 │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
    │
    ▼ userId
┌───────────────────────────────────────┐
│           API Routes Layer            │
│  /api/v1/chat                         │
│  /api/v1/conversations                │
│  /api/v1/agents                       │
│  /api/v1/skills                       │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│           Business Layer              │
│  - ModelService 统一模型创建          │
│  - ChatSessionService 会话服务        │
│  - MessageService 消息服务            │
│  - McpRuntime MCP 运行时（尽力模式）  │
│  - SandboxFactory 沙盒工厂            │
│  - mergeAgentToolSets 工具合并        │
│  - Skill 加载到沙盒                   │
│  - 会话权限验证与压缩检测             │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│           Data Layer                  │
│  - Supabase PostgreSQL                │
│  - Supabase Storage                   │
│  - schemas/ 统一 Schema 管理          │
└───────────────────────────────────────┘
```

## 认证机制

### API Key 格式

API Key 采用前缀标识格式：

```
sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- 前缀 `sk_live_` 表示正式环境密钥
- 后缀为随机生成的安全字符串

### 请求头要求

所有 V1 API 请求必须在请求头中携带 API Key：

```http
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

也可以直接传递（不推荐）：

```http
Authorization: sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 认证流程

1. **提取 API Key**：从 Authorization 头提取 Bearer Token
2. **格式验证**：检查是否以 `sk_live_` 开头
3. **哈希计算**：使用 SHA-256 计算 API Key 哈希值
4. **数据库验证**：查询数据库匹配哈希值，获取关联的 userId
5. **速率检查**：检查客户端 IP 的请求频率

### 错误码说明

| 错误码 | 说明 | HTTP Status |
|--------|------|-------------|
| UNAUTHORIZED | 未提供 API Key | 401 |
| INVALID_API_KEY | API Key 格式错误或无效 | 401 |
| RATE_LIMITED | 请求过于频繁（锁定） | 401 |
| RATE_LIMIT_EXCEEDED | 请求次数超限 | 401 |

## API端点说明

### POST /api/v1/chat - 流式对话

**功能**：发起流式对话，支持指定 Agent 和会话。

**请求参数**：

```json
{
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "你好" }]
  },
  "conversationId": "可选，已有会话ID",
  "agentId": "必需，Agent ID"
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| message | UIMessage | 是 | 单条新消息（前端只发送最后一条），AI SDK 格式 |
| conversationId | string | 否 | 已有会话 ID，不提供则创建新会话 |
| agentId | string | 是 | 要使用的 Agent ID |

**响应格式**：

- 流式 SSE 响应（UIMessageStreamResponse）
- 响应头包含 `X-Conversation-Id`（新建或已有会话 ID）

**聊天处理流程**：

1. 验证 API Key（lib/infra/user/api-key）
2. 验证参数（message、agentId）
3. 并行启动异步查询（Early-start 优化）：
   - 默认模型查询（getDefaultUserModel）
   - Agent Skills 信息查询（getAgentSkillsInfo）
   - 会话查询（如已提供 conversationId）
4. 获取 Agent 配置（getAgentById，检查权限）
5. 获取或创建会话（验证会话归属；新会话通过 ChatSessionService 创建）
6. 获取用户模型配置，通过 ModelService 创建模型实例（lib/infra/model）
7. 加载 Agent Skills 到沙盒（loadSkillsToSandbox，lib/infra/sandbox）
8. 创建运行时工具：
   - 沙盒工具：当前 V1 API 调用 `createSandboxTools()` 返回空对象 `{}`（该函数已废弃，不支持沙盒命令执行）
   - MCP 运行时工具（createMcpRuntime，lib/infra/mcp，尽力模式）
9. 合并工具集（mergeAgentToolSets：系统工具优先，MCP 补充）
10. 检查并执行未处理的压缩任务（executeCompressionTask）
11. 加载历史消息（loadHistoryMessages）+ 通过 MessageService 保存用户消息（lib/infra/message）
12. 创建 ToolLoopAgent 实例（stopWhen: stepCountIs(10)），配置 experimental_context：
    - `getSandbox` 函数返回 `{ sessionId, userId }`（预留配置，当前因沙盒工具集为空不生效）
13. 流式执行并返回
14. onFinish 回调：通过 MessageService 保存助手消息、通过 ChatSessionService 更新 token 统计、清理 MCP 连接

**错误响应**：

```json
// 消息为空
{ "error": "消息不能为空" }  // 400

// Agent ID 为空
{ "error": "agentId 不能为空" }  // 400

// Agent 不存在
{ "error": "Agent 不存在或无权访问" }  // 404

// 会话不存在
{ "error": { "code": "NOT_FOUND", "message": "会话不存在" } }  // 404

// 会话权限错误
{ "error": { "code": "FORBIDDEN", "message": "无权访问该会话" } }  // 403
```

---

### GET/POST /api/v1/conversations - 会话管理

#### GET - 获取会话列表

**功能**：获取通过 API 创建的会话列表。

**请求**：无额外参数。

**响应格式**：

```json
{
  "conversations": [
    {
      "id": "abc123",
      "title": "关于天气的讨论",
      "agentId": "production",
      "source": "api-v1",
      "createdAt": "2026-03-31T10:00:00Z",
      "updatedAt": "2026-03-31T12:00:00Z"
    }
  ]
}
```

**注意**：仅返回 `source: "api-v1"` 的会话，不包含 Web 页面创建的会话。

#### POST - 创建新会话

**功能**：预先创建会话，便于后续对话。

**请求参数**：

```json
{
  "title": "可选，会话标题",
  "agentId": "必填，Agent ID，无默认值"
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| title | string | 否 | 会话标题，默认 "新对话" |
| agentId | string | 是 | Agent ID，**必填字段，无默认值** |

**响应格式**（HTTP 201）：

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "新对话",
    "agentId": "production",
    "createdAt": "2026-03-31T10:00:00Z"
  }
}
```

**错误响应**：

```json
// agentId 为空或未提供
{ "error": { "code": "BAD_REQUEST", "message": "agentId 是必填字段" } }  // 400
```

---

### GET/DELETE /api/v1/conversations/[id] - 会话详情

#### GET - 获取会话详情

**功能**：获取会话详情及消息列表。

**响应格式**：

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "关于天气的讨论",
    "agentId": "production",
    "source": "api-v1",
    "createdAt": "2026-03-31T10:00:00Z",
    "updatedAt": "2026-03-31T12:00:00Z",
    "messages": [
      {
        "id": "msg1",
        "role": "user",
        "content": "你好",
        "createdAt": "2026-03-31T10:00:00Z"
      },
      {
        "id": "msg2",
        "role": "assistant",
        "content": "你好，有什么可以帮助你的？",
        "createdAt": "2026-03-31T10:01:00Z"
      }
    ]
  }
}
```

#### DELETE - 删除会话

**功能**：删除指定会话及其消息。

**响应格式**：

```json
{
  "success": true
}
```

**错误响应**：

```json
{ "error": { "code": "NOT_FOUND", "message": "会话不存在" } }  // 404
```

---

### GET /api/v1/conversations/[id]/messages - 消息列表

**功能**：获取指定会话的消息列表。

**响应格式**：

```json
{
  "messages": [
    {
      "id": "msg1",
      "role": "user",
      "content": "你好",
      "createdAt": "2026-03-31T10:00:00Z"
    }
  ]
}
```

---

### GET /api/v1/agents - Agent列表

**功能**：获取用户可访问的 Agent 列表。

**说明**：返回用户创建的私有 Agent 和公开 Agent，去重合并。

**响应格式**：

```json
{
  "agents": [
    {
      "id": "agent1",
      "name": "通用助手",
      "description": "帮助回答各类问题",
      "isPublic": true,
      "isOwner": false
    },
    {
      "id": "agent2",
      "name": "我的助手",
      "description": "自定义助手",
      "isPublic": false,
      "isOwner": true
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| id | Agent ID |
| name | Agent 名称 |
| description | Agent 描述 |
| isPublic | 是否公开 |
| isOwner | 当前用户是否为创建者 |

---

### GET /api/v1/skills - Skill列表

**功能**：获取用户的 Skill 列表。

**响应格式**：

```json
{
  "skills": [
    {
      "id": "skill1",
      "name": "代码审查",
      "description": "帮助审查代码质量",
      "agentCount": 3,
      "createdAt": "2026-03-31T10:00:00Z",
      "updatedAt": "2026-03-31T12:00:00Z"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| id | Skill ID |
| name | Skill 名称 |
| description | Skill 描述 |
| agentCount | 关联的 Agent 数量 |
| createdAt | 创建时间 |
| updatedAt | 更新时间 |

---

### PUT /api/v1/skills/[id] - Skill更新

**功能**：更新 Skill 文件内容。

**请求参数**：

```json
{
  "content": "Skill 文件的完整内容（Markdown 格式）"
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| content | string | 是 | Skill 文件内容，需符合格式校验 |

**响应格式**：

```json
{
  "success": true,
  "data": {
    "id": "skill1",
    "name": "代码审查",
    "description": "帮助审查代码质量",
    "updatedAt": "2026-03-31T12:00:00Z"
  }
}
```

**错误响应**：

```json
// Skill 不存在
{ "error": { "code": "NOT_FOUND", "message": "Skill 不存在或无权访问" } }  // 404

// 内容为空
{ "error": { "code": "VALIDATION_ERROR", "message": "Skill 内容不能为空" } }  // 400

// 格式校验失败
{ "error": { "code": "UNPROCESSABLE_ENTITY", "message": "Skill 文件校验失败", "details": { "reason": "缺少必需的元数据字段" } } }  // 422
```

## 请求/响应格式

### 统一错误码

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| UNAUTHORIZED | 401 | 认证失败（未提供 API Key） |
| INVALID_API_KEY | 401 | API Key 无效或已过期 |
| RATE_LIMITED | 401 | 请求过于频繁，被锁定 |
| RATE_LIMIT_EXCEEDED | 401 | 请求次数超限 |
| NOT_FOUND | 404 | 资源不存在 |
| FORBIDDEN | 403 | 无权访问 |
| VALIDATION_ERROR | 400 | 参数校验失败 |
| UNPROCESSABLE_ENTITY | 422 | 内容格式校验失败 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

### 错误响应格式

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "会话不存在"
  }
}
```

部分错误可能包含 details 字段：

```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Skill 文件校验失败",
    "details": {
      "reason": "缺少必需的元数据字段"
    }
  }
}
```

### 流式响应处理

对话接口返回 SSE（Server-Sent Events）流式响应：

1. 响应头 `Content-Type: text/event-stream`
2. 响应头 `X-Conversation-Id` 包含会话 ID
3. 数据格式为 AI SDK 的 UIMessageStream 格式

客户端处理示例：

```javascript
const response = await fetch('/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: { role: 'user', parts: [{ type: 'text', text: '你好' }] },
    agentId: 'production',
  }),
});

// 获取会话 ID
const conversationId = response.headers.get('X-Conversation-Id');

// 处理流式响应
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // 处理数据块...
}
```

## 使用指南

### 获取 API Key

API Key 需要在系统中创建，步骤如下：

1. 登录系统
2. 进入 API Key 管理页面
3. 创建新的 API Key
4. 安全保存 API Key（仅显示一次）

### 使用 API Key 调用示例

#### curl 示例

**发起对话**：

```bash
curl -X POST https://your-domain.com/api/v1/chat \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "message": { "role": "user", "parts": [{ "type": "text", "text": "你好，请介绍一下你自己" }] },
    "agentId": "production"
  }'
```

**获取会话列表**：

```bash
curl -X GET https://your-domain.com/api/v1/conversations \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**创建新会话**：

```bash
curl -X POST https://your-domain.com/api/v1/conversations \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "我的新对话",
    "agentId": "production"
  }'
```

**获取 Agent 列表**：

```bash
curl -X GET https://your-domain.com/api/v1/agents \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**获取 Skill 列表**：

```bash
curl -X GET https://your-domain.com/api/v1/skills \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

#### Python 示例

```python
import requests

API_KEY = "sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL = "https://your-domain.com/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 发起对话
response = requests.post(
    f"{BASE_URL}/chat",
    headers=headers,
    json={
        "message": {"role": "user", "parts": [{"type": "text", "text": "你好"}]},
        "agentId": "production"
    },
    stream=True
)

# 获取会话 ID
conversation_id = response.headers.get("X-Conversation-Id")

# 处理流式响应
for chunk in response.iter_content(chunk_size=1024):
    if chunk:
        print(chunk.decode('utf-8'))
```

## 注意事项

### 会话归属验证

- 所有会话操作都会验证会话是否属于当前 API Key 关联的用户
- 无法访问其他用户创建的会话
- 会话不存在返回 404，权限错误返回 403

### Agent 权限检查

- `/api/v1/chat` 需要指定 `agentId`
- 用户只能使用自己创建的 Agent 或公开 Agent
- Agent 不存在或无权访问返回 404

### 流式响应处理

1. 对话接口返回 SSE 流式响应
2. 需要正确处理 `Content-Type: text/event-stream`
3. 响应头 `X-Conversation-Id` 包含会话 ID，可用于后续请求
4. 超时时间设置为 60 秒（maxDuration = 60）
5. ToolLoopAgent 使用 `stopWhen: stepCountIs(10)` 限制最大执行步数

### API Key 安全

- API Key 应安全存储，避免泄露
- 建议使用环境变量存储，不在代码中硬编码
- 可以为不同应用创建不同的 API Key
- 发现泄露应立即删除并重新创建

### 会话隔离

- API 创建的会话（source: "api-v1"）与 Web 页面创建的会话隔离
- `/api/v1/conversations` 仅返回 API 创建的会话
- 便于外部程序独立管理会话历史

### 沙盒工具限制

- 当前 V1 API 不支持沙盒命令执行（bash、readFile、writeFile）
- `createSandboxTools()` 函数已废弃，返回空对象 `{}`
- 正确的工具创建方式是 `getSandboxToolsWithContext(context)`，但 V1 API 当前未使用
- Agent Skills 加载到沙盒后，相关命令执行功能暂不可用

## 相关文件清单

### API 路由层

| 文件路径 | 功能说明 |
|----------|----------|
| `app/api/v1/chat/route.ts` | 流式对话接口入口 |
| `app/api/v1/conversations/route.ts` | 会话列表接口（GET/POST） |
| `app/api/v1/conversations/[id]/route.ts` | 会话详情接口（GET/DELETE） |
| `app/api/v1/conversations/[id]/messages/route.ts` | 消息列表接口（GET） |
| `app/api/v1/agents/route.ts` | Agent 列表接口（GET） |
| `app/api/v1/skills/route.ts` | Skill 列表接口（GET） |
| `app/api/v1/skills/[id]/route.ts` | Skill 更新接口（PUT） |

### 基础设施层（lib/infra/）

| 文件路径 | 功能说明 |
|----------|----------|
| `lib/infra/user/api-key.ts` | API Key 认证中间件，包含提取、验证、速率限制 |
| `lib/infra/user/middleware.ts` | 内部认证中间件（JWT），非 V1 API 使用 |
| `lib/infra/user/rate-limiter.ts` | 速率限制工具 |
| `lib/infra/model/index.ts` | ModelService 统一模型创建入口（单例模式） |
| `lib/infra/model/user-provider.ts` | 用户模型 Provider 创建 |
| `lib/infra/model/middleware.ts` | 模型 DevTools 包装中间件 |
| `lib/infra/model/provider-registry.ts` | Provider 注册表 |
| `lib/infra/session/index.ts` | 会话服务导出入口 |
| `lib/infra/session/types.ts` | 会话服务类型定义（SessionService、ChatSessionService、WorkflowSessionService） |
| `lib/infra/session/service.ts` | 基础会话服务实现（CRUD） |
| `lib/infra/session/chat-service.ts` | Chat 会话服务（token 汇总 + 压缩缓存） |
| `lib/infra/session/workflow-service.ts` | Workflow 会话服务（CAS 原子操作） |
| `lib/infra/message/index.ts` | 消息服务导出入口 |
| `lib/infra/message/types.ts` | 消息服务类型定义 |
| `lib/infra/message/service.ts` | 消息服务实现（CRUD） |
| `lib/infra/mcp/` | MCP 运行时核心实现（连接/工具挂载/诊断/清理） |
| `lib/infra/sandbox/` | 沙盒工厂、工具集、Skill 加载、配置 |
| `lib/infra/skills/` | Skill 文件校验 |
| `lib/infra/supabase/` | Supabase Storage 文件操作 |

### Agent 工具层

| 文件路径 | 功能说明 |
|----------|----------|
| `lib/agents/toolset-merge.ts` | 工具集合并（系统工具优先，MCP 补充缺失键） |

### 数据层

| 文件路径 | 功能说明 |
|----------|----------|
| `lib/db/compression.ts` | 消息压缩相关（检测、执行、加载历史） |
| `lib/db/agents.ts` | Agent 数据库操作（含 getAgentSkillsInfo） |
| `lib/db/api-keys.ts` | API Key 数据库操作（验证、哈希） |
| `lib/db/conversations.ts` | 会话数据库操作 |
| `lib/db/messages.ts` | 消息数据库操作 |
| `lib/db/user-models.ts` | 用户模型数据库操作 |
| `lib/db/skills.ts` | Skill 数据库操作 |

### Schema 层

| 文件路径 | 功能说明 |
|----------|----------|
| `lib/schemas/index.ts` | Schema 统一导出入口（替代原 lib/db/schema.ts） |
| `lib/schemas/model.ts` | 用户模型 Schema |
| `lib/schemas/api-key.ts` | API Key Schema |
| `lib/schemas/conversation.ts` | 对话和消息 Schema |
| `lib/schemas/agent.ts` | Agent Schema |
| `lib/schemas/tool.ts` | MCP 工具和 Skill Schema |
| `lib/schemas/system.ts` | 系统 Schema（压缩、检查点、消息撤回） |
| `lib/schemas/document.ts` | 文档系统 Schema |
| `lib/schemas/user.ts` | 用户 Schema |

---

**版本**：v1.5
**创建时间**：2026-03-31
**最后更新**：2026-05-01