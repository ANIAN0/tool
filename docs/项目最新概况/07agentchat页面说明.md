# Agent Chat 页面说明

> **文档目的：** 说明主对话入口 **`/agent-chat`**（**不是** 已移除的 `/chat`）的前后端结构与数据流。
> **系统概述：** 新会话页预生成 id；已有会话为 **`/agent-chat/[id]`**。客户端使用 **`useChat`** + **`DefaultChatTransport`** 请求 **`POST /api/agent-chat`**，认证头通过 **`useAuth` Hook** 自动设置 **`Authorization: Bearer ${accessToken}`**（JWT Token），未登录用户无法访问（返回 401）；对话列表来自 **`GET /api/agent-conversations`**（仅 `source = 'agent-chat'`）。工具侧：**沙盒系统工具 + MCP 运行时工具**（白名单筛选、尽力模式挂载）+ **Skill 系统集成**（预置提示词合并）。
> **技术栈：** Next.js App Router、`@ai-sdk/react`、`ai` ToolLoopAgent、`@ai-sdk/mcp`、Turso 消息/会话表
>
> **架构说明：** 后端业务模块已从 `app/api/agent-chat/_lib/` 迁移到 `lib/agent-chat/`，前端组件从单一 `AgentChatClient` 拆分为 **Context + 组合子组件** 模式（`AgentChatProvider`、`AgentChatConversation`、`AgentChatInput`、`MessageActions` 等）。

---

## 目录

1. [系统架构](#1-系统架构)
2. [数据库设计](#2-数据库设计)
3. [后端实现](#3-后端实现)
   - [3.1 POST /api/agent-chat](#31-post-apiagent-chat)
   - [3.2 GET /api/agent-conversations](#32-get-apiagent-conversations)
   - [3.3 GET /api/conversations/:id](#33-get-apiconversationsid)
   - [3.4 MCP 运行时工具注入](#34-mcp-运行时工具注入)
   - [3.5 Skill 系统集成](#35-skill-系统集成)
   - [3.6 消息撤回 API](#36-消息撤回-api)
   - [3.7 会话压缩持久化机制](#37-会话压缩持久化机制)
   - [3.8 Token 统计](#38-token-统计)
4. [前端实现](#4-前端实现)
   - [4.1 核心组件](#41-核心组件)
   - [4.2 历史消息加载](#42-历史消息加载)
   - [4.3 浏览器导航监听](#43-浏览器导航监听)
   - [4.4 URL 更新机制](#44-url-更新机制)
   - [4.5 移动端响应式设计](#45-移动端响应式设计)
5. [使用指南](#5-使用指南)
6. [注意事项](#6-注意事项)
7. [相关文件清单](#7-相关文件清单)

---

## 1. 系统架构

| 路径 | 说明 |
|------|------|
| `app/agent-chat/page.tsx` | 新对话：`nanoid()` 生成 id，渲染 `AgentChatClient` |
| `app/agent-chat/[id]/page.tsx` | 已有对话：动态 `[id]` |
| `app/agent-chat/layout.tsx` | 全屏容器布局 |
| `components/agent-chat/agent-chat-client.tsx` | 组合组件入口，组装 Provider + Frame + Header + Conversation + Input + Dialogs |
| `components/agent-chat/agent-chat-context.tsx` | `AgentChatProvider`：全局状态管理（Context + Provider 模式） |
| `components/agent-chat/agent-chat-frame.tsx` | 外层布局容器（侧边栏 + 主对话区） |
| `components/agent-chat/agent-chat-header.tsx` | 顶部导航（Context 组件 + Agent 选择器 + 用户菜单） |
| `components/agent-chat/agent-chat-conversation.tsx` | 消息列表区域（渲染消息、工具调用、Checkpoint 分割线） |
| `components/agent-chat/agent-chat-input.tsx` | 输入区域（封装 `PromptSection`） |
| `components/agent-chat/message-actions.tsx` | 消息操作栏（`AssistantMessageActions`、`UserMessageActions`、`MessageActions`） |
| `components/agent-chat/agent-chat-dialogs.tsx` | 确认对话框（删除确认、编辑确认） |
| `components/agent-chat/sidebar.tsx` | 历史对话侧栏 |
| `components/agent-chat/db-agent-selector.tsx` | Agent 选择器 |
| `components/agent-chat/prompt-section.tsx` | 输入框组件 |
| `app/api/agent-chat/route.ts` | 对话 API 入口（组装者，调用 `lib/agent-chat` 模块） |
| `lib/agent-chat/index.ts` | 业务模块统一导出 |
| `lib/agent-chat/types.ts` | 类型定义（Result 模式：ok/error） |
| `lib/agent-chat/request.ts` | 请求解析（parseChatRequestBody） |
| `lib/agent-chat/auth-context.ts` | 认证验证（getAuthContext） |
| `lib/agent-chat/agent-loader.ts` | Agent 配置加载与权限验证（loadAgentConfig） |
| `lib/agent-chat/model-resolver.ts` | 模型解析与构建（resolveModel、wrapModel） |
| `lib/agent-chat/conversation.ts` | 会话管理（ensureConversation、loadHistory、saveUserMessage） |
| `lib/agent-chat/runtime.ts` | 运行时创建与 Agent 执行（createRuntime、executeAgent） |
| `lib/agent-chat/response.ts` | 流式响应构建与消息落库（buildStreamResponse） |
| `lib/agent-chat/utils.ts` | 消息格式转换工具函数 |
| `app/api/agent-conversations/route.ts` | Agent 对话列表 |
| `app/api/conversations/[id]/route.ts` | 已有会话消息获取 |
| `lib/infra/sandbox/skill-loader.ts` | Skill 运行时加载器 |
| `lib/db/agents.ts` | Agent 数据访问层（含 Skill 关联） |
| `lib/infra/user/middleware.ts` | 认证中间件（仅 JWT） |

---

## 2. 数据库设计

- **会话：** 创建时使用 **`source: 'agent-chat'`** 标记，便于列表 API 过滤；同时绑定 **`agentId`** 标记使用的 Agent。
- **消息：** 用户/助手消息以 JSON 序列化的 UIMessage 存入消息表（详见 `lib/db` 中 `createMessage` / `createConversation`）。
- **Agent-Skill 关联：** 通过 `agent_skills` 表存储 Agent 与 Skill 的多对多关系，创建带 Skill 的 Agent 时强制包含 `bash`、`readFile`、`writeFile` 系统工具。

---

## 3. 后端实现

### 3.1 `POST /api/agent-chat`

**Body（核心字段）：** `messages`（UIMessage[]）、**`conversationId`**（必填）、**`agentId`**。
**Header：** 认证头使用 JWT Token：`Authorization: Bearer ${accessToken}`。未登录用户无法访问（返回 401 错误）。

**流程概要（`route.ts` 作为组装者，各步骤分散在 `lib/agent-chat/` 模块中）：**

1. **请求解析：** `parseChatRequestBody`（`lib/agent-chat/request.ts`）— 提取 message、conversationId、agentId，验证必需字段。
2. **认证验证：** `getAuthContext`（`lib/agent-chat/auth-context.ts`）— 使用 `authenticateRequestOptional` 验证用户身份（仅支持 JWT，未登录用户返回 401 错误）。
3. **Agent 加载：** `loadAgentConfig`（`lib/agent-chat/agent-loader.ts`）— 获取 Agent 配置并验证访问权限（公开 / 私有）。
4. **模型解析：** `resolveModel`（`lib/agent-chat/model-resolver.ts`）— 根据 Agent 绑定模型或用户默认模型构建聊天模型实例；`wrapModel` 应用压缩检测中间件。
5. **会话确保：** `ensureConversation`（`lib/agent-chat/conversation.ts`）— 若 `conversationId` 对应会话不存在则创建（标题由首条用户消息截取，标记 `source: 'agent-chat'`），存在则验证权限。
6. **运行时创建：** `createRuntime`（`lib/agent-chat/runtime.ts`）— 加载 Skill 到沙盒、构建系统提示词（含预置提示词）、创建沙盒工具、构建 MCP 运行时工具（best-effort）、合并工具集合（系统工具优先）。
7. **历史加载：** `loadHistory`（`lib/agent-chat/conversation.ts`）— 执行待处理压缩任务，加载历史消息。
8. **保存用户消息：** `saveUserMessage`（`lib/agent-chat/conversation.ts`）— 用户消息落库。
9. **Agent 执行：** `executeAgent`（`lib/agent-chat/runtime.ts`）— 合并历史+当前消息，转换格式，`ToolLoopAgent.stream` 执行流式响应。
10. **构建响应：** `buildStreamResponse`（`lib/agent-chat/response.ts`）— 返回流式响应（含 sources/reasoning 配置），`onFinish` 回调保存助手消息、更新 Token 统计、清理 MCP 连接。

**错误处理 — Result 模式：**

各模块均返回 `{ ok: true, ...data }` 或 `{ ok: false, response: Response }` 的 Result 类型。`route.ts` 组装者通过 `if (!result.ok) return result.response` 模式统一处理错误，任何步骤失败立即短路返回错误响应，避免深层嵌套 try-catch。

### 3.2 `GET /api/agent-conversations`

**Header：** 认证头使用 JWT Token：`Authorization: Bearer ${accessToken}`。未登录用户无法访问（返回 401 错误）。

调用 **`getConversationsWithFilter(userId, { source: 'agent-chat' })`**，返回 `{ conversations }`。

### 3.3 `GET /api/conversations/:id`

**用途：** 获取已有会话的完整信息及历史消息列表，用于前端加载历史对话内容。

**Header：** 认证头使用 JWT Token：`Authorization: Bearer ${accessToken}`。未登录用户无法访问（返回 401 错误）。

**响应格式：**
```json
{
  "conversation": {
    "id": "...",
    "title": "...",
    "agent_id": "...",
    ...
  },
  "messages": [
    { "id": "...", "role": "user", "content": "..." },
    { "id": "...", "role": "assistant", "content": "..." }
  ]
}
```

**权限验证：** 只能访问自己的对话（`user_id === userId`）。

**前端使用：** 通过 `authenticatedFetch(`/api/conversations/${id}`)` 获取数据，使用 `dbMessageToUIMessage` 转换消息格式后设置到 `useChat` 的 `messages`。

### 3.4 MCP 运行时工具注入

MCP 运行时工具按 Agent 配置动态挂载，采用 **尽力模式**（单服务失败不阻断对话）。

**核心流程：**

1. **读取配置：** `getAgentMcpRuntimeToolConfigs(agentId, agentOwnerUserId)` 获取 Agent 绑定的 MCP 工具配置列表（含 server url、headers、is_enabled、toolName）。
2. **按 Server 分组：** 同一 Server 仅建连一次，避免重复连接。
3. **逐 Server 建连：**
   - 若 Server 被禁用（`is_enabled = false`），跳过并记录诊断日志。
   - 使用 `createMCPClient` 建立 HTTP 连接，失败则跳过并记录诊断日志。
   - 拉取 Server 工具列表 `client.tools()`，失败则跳过并记录诊断日志。
4. **白名单筛选：** 仅注入 Agent 选中的工具（`toolName` 在配置列表中）。
5. **工具命名：** 注入名直接使用经 `sanitizeName` 清洗后的原始工具名（将非字母数字下划线字符替换为下划线），唯一性由 Agent 配置时保证。运行时保留兜底冲突检测，若重名则追加递增后缀。
6. **合并工具集：** `mergeAgentToolSets` 将 MCP 工具与沙盒系统工具合并，**系统工具优先**（同名时保留系统工具）。
7. **清理连接：** 对话结束后统一调用 `cleanup()` 关闭所有 MCP 客户端连接，避免泄漏。

**诊断日志：**

运行时输出结构化摘要日志，便于线上排障：

```json
{
  "agentId": "...",
  "conversationId": "...",
  "mcpServerCount": 2,
  "mcpMappedToolCount": 5,
  "diagnosticsSummary": {
    "SERVER_DISABLED": 0,
    "SERVER_CONNECT_FAILED": 1,
    "REMOTE_TOOLS_FETCH_FAILED": 0,
    "TOOL_NOT_FOUND_ON_SERVER": 0,
    "TOOL_MAPPED": 5
  },
  "diagnosticsDetails": [...]
}
```

**诊断码说明：**

| 诊断码 | 含义 |
|--------|------|
| `SERVER_DISABLED` | MCP 服务被禁用，已跳过 |
| `SERVER_CONNECT_FAILED` | MCP 服务连接失败，已跳过 |
| `REMOTE_TOOLS_FETCH_FAILED` | 工具列表拉取失败，已跳过 |
| `TOOL_NOT_FOUND_ON_SERVER` | Agent 选中的工具在远端未找到，已跳过 |
| `TOOL_MAPPED` | MCP 工具挂载成功 |

### 3.5 Skill 系统集成

Skill 是预配置的能力模块，在对话开始时自动加载到沙盒工作区，并通过预置提示词告知 Agent 如何使用。

**核心流程：**

1. **获取 Skill 信息：** 调用 `getAgentSkillsInfo(agentId)` 从 `agent_skills` 表查询 Agent 关联的 Skill（包含 `fileHash` 用于版本检测）。
2. **检查版本：** 使用 `isSkillUpToDate` 检查沙盒中是否已存在最新版本的 Skill（检查 `skills/{skillId}/SKILL.md` 文件）。
3. **下载并写入：** 若 Skill 未存在或版本过期，调用 `downloadSkillDirectoryToSandbox`：
   - 从 Supabase Storage 下载 Skill 目录所有文件
   - 创建沙盒目录 `skills/{skillId}`（777 权限）
   - 逐文件写入沙盒
4. **生成预置提示词：** `generatePresetPrompt` 生成包含 Skill 列表和使用说明的提示词：
   ```markdown
   ## 已配置的 Skills

   以下 Skills 已配置到你的环境中，位于沙盒 `skills/` 目录下：

   - **{skillName}**: {description}
     - 文件路径: `skills/{skillId}/skill.md`

   ### 如何使用 Skills

   1. **读取 Skill 正文**: 使用 `readFile` 工具读取 `skills/{skillId}/skill.md`
   2. **读取 Skill 目录下的文件**: 使用 `readFile` 工具读取 `skills/{skillId}/` 下的其他文件
   3. **执行 Skill 目录下的脚本**: 使用 `bash` 工具执行 `skills/{skillId}/` 下的脚本文件
   ```
5. **合并系统提示词：** 将预置提示词追加到 Agent 的 `system_prompt` 后面，形成完整的系统提示词。

**返回结果结构：**
```typescript
interface LoadSkillsResult {
  success: boolean;
  loadedSkills: string[];    // 成功加载的 skillId 列表
  skippedSkills: string[];   // 跳过的 skillId 列表（已是最新）
  errors: Array<{ skillId: string; error: string }>;
  presetPrompt: string;      // 生成的预置提示词
}
```

### 3.6 消息撤回 API

**路径：** `DELETE /api/messages/[id]/delete`

**用途：** 用户删除消息时，级联删除目标消息及之后所有消息，并将删除的消息归档到 `deleted_messages` 表。

**请求参数：**
- `id`: 消息ID（URL路径参数）

**响应格式：**
```json
{
  "success": true,
  "deletedCount": 5  // 删除的消息数量（包含目标消息及后续消息）
}
```

**核心逻辑：**
1. **认证验证：** 使用 `authenticateRequestOptional` 验证用户身份。
2. **查询目标消息：** 验证消息存在性和对话所有权。
3. **级联删除：** 删除目标消息及 `created_at >= targetCreatedAt` 的所有后续消息。
4. **归档处理：** 所有删除的消息归档到 `deleted_messages` 表，保留原消息内容便于排查。
5. **事务保证：** 使用 `db.batch()` 保证归档和删除的原子性。

**幂等性设计：** 如果消息已不存在（可能已被其他操作删除），返回 `deletedCount: 0`，不抛出错误。

**限制：** 只能删除 checkpoint 之后的消息，不影响 `compression_cache`（因为缓存存储的是 checkpoint 之前的消息）。

### 3.7 会话压缩持久化机制

会话压缩用于控制对话上下文长度，采用异步任务调度模式，将压缩结果持久化到数据库。

**核心流程：**

1. **触发条件：** 当对话消息数量接近模型上下文上限时触发压缩。
2. **创建任务：** 在 `compression_tasks` 表创建 pending 状态任务（每个会话只能有1个未处理任务）。
3. **执行压缩：** 调用 `executeCompressionTask`：
   - 加载历史消息（使用 `loadHistoryMessages`）
   - 计算50%移除数量（保留至少1条消息）
   - 移除最早的消息
   - 创建 Checkpoint 记录（存入 `checkpoints` 表）
   - 更新 `compression_cache`（存入 `conversations.compression_cache`）
4. **标记完成：** 更新任务状态为 completed。

**数据结构：**

```typescript
// 压缩缓存（存储在 conversations.compression_cache）
interface CompressionCache {
  messages: UIMessage[];       // 压缩后的消息快照
  messageCount: number;        // 压缩时的消息总数
  removedCount: number;        // 被移除的消息数量
  compressedAt: number;        // 压缩时间戳
}

// Checkpoint 记录（独立表）
interface Checkpoint {
  id: string;
  conversation_id: string;
  removed_count: number;
  original_message_count: number;
  created_at: number;
  cache_content?: string | null;  // 压缩缓存内容，便于排查
}
```

**消息加载逻辑：**
- 有 `compression_cache` 时：缓存消息 + checkpoint 之后的消息
- 无缓存或缓存损坏时：全部消息（缓存损坏时自动清除）

**数据库表：**
- `compression_tasks`: 压缩任务表（id, conversation_id, status, created_at, completed_at）
- `checkpoints`: 检查点表（id, conversation_id, removed_count, original_message_count, created_at, cache_content）

### 3.8 Token 统计

**用途：** 记录每条消息和每个对话的 Token 消耗，用于成本分析和上下文控制。

**字段定义：**

| 表 | 字段 | 说明 |
|---|---|---|
| `messages` | `input_tokens` | 输入 token 数（仅 assistant 消息有值） |
| `messages` | `output_tokens` | 输出 token 数（仅 assistant 消息有值） |
| `messages` | `total_tokens` | 总 token 数（仅 assistant 消息有值） |
| `conversations` | `total_input_tokens` | 对话累计输入 token |
| `conversations` | `total_output_tokens` | 对话累计输出 token |
| `conversations` | `total_tokens` | 对话累计总 token |

**Token 估算规则：**
- ASCII 字符（英文/数字/符号）：约 4 字符 = 1 token
- 非 ASCII 字符（中文等）：约 1.5 字符 = 1 token

**测试页面：** `/settings/token-test` 提供 Token 估算测试功能。

---

## 4. 前端实现

### 4.1 核心组件（Context + 组合子组件模式）

前端组件采用 **Context + 组合子组件** 架构，将单一的 `AgentChatClient` 拆分为独立的职责模块。

**组件层次结构：**

```
AgentChatClient（组合入口）
├── AgentChatProvider（全局状态管理）
│   ├── AgentChatFrame（外层布局容器）
│   │   ├── AgentChatSidebar（侧边栏）
│   │   ├── AgentChatHeader（顶部导航）
│   │   ├── AgentChatConversation（消息列表）
│   │   └── AgentChatInput（输入区域）
│   └── AgentChatDialogs（确认对话框）
```

**`AgentChatProvider`**（`agent-chat-context.tsx`）是核心状态管理组件：
- 创建 `AgentChatContext`，通过 `useAgentChatContext()` Hook 暴露状态
- 状态分为三层：`state`（核心数据）、`actions`（操作函数）、`meta`（元数据）
- 管理 `useChat` hook、transport 配置、对话列表、消息加载、URL 更新等逻辑
- 通过 `prepareSendMessagesRequest` 只发送最后一条消息，避免重复

**`AgentChatConversation`**（`agent-chat-conversation.tsx`）负责消息列表渲染：
- 渲染文本消息、工具调用（Tool）、步骤分割线
- 显示 Checkpoint 分割线（压缩历史标记）
- 集成 `MessageActions` 显示消息操作栏

**`AgentChatInput`**（`agent-chat-input.tsx`）负责输入区域：
- 封装 `PromptSection` 组件
- 支持编辑预填充（`prefillInput`）和强制重渲染（`inputKey`）

**`MessageActions`**（`message-actions.tsx`）提供消息操作：
- `AssistantMessageActions`：显示 token 统计和复制按钮
- `UserMessageActions`：显示复制、编辑、删除按钮
- `MessageActions`：通用包装器，根据 role 自动选择变体

**`AgentChatFrame`**（`agent-chat-frame.tsx`）是布局容器：
- 包含侧边栏（220px）和主对话区
- 移动端侧边栏默认隐藏，点击汉堡菜单展开

**`AgentChatHeader`**（`agent-chat-header.tsx`）是顶部导航：
- 显示对话标题、Context 组件（token 用量）、Agent 选择器、用户菜单

**`AgentChatDialogs`**（`agent-chat-dialogs.tsx`）管理确认对话框：
- 删除确认对话框（级联删除消息）
- 编辑确认对话框（删除后填入输入框）

**复合导出：** `AgentChat` 对象导出所有子组件，支持灵活组合：
```typescript
// 标准用法
<AgentChat.Client id="conversation-id" />

// 自定义组合
<AgentChat.Provider conversationId="id">
  <AgentChat.Frame>
    <CustomHeader />
    <AgentChat.Conversation />
    <AgentChat.Input />
  </AgentChat.Frame>
</AgentChat.Provider>
```

**侧栏：** `AgentChatSidebar` 拉取 `/api/agent-conversations` 展示历史，支持重命名、删除。

**认证管理：** 通过 **`useAuth` Hook** 统一管理认证状态：
- `authenticatedFetch()` 方法支持自动刷新过期 Token 并重试请求
- transport 配置中直接读取 `localStorage.getItem("accessToken")`，避免 React state 闭包问题

**传输配置：** `DefaultChatTransport` 指向 **`/api/agent-chat`**，通过 `prepareSendMessagesRequest` 动态设置认证头和请求体。

### 4.2 历史消息加载

当访问已有对话 `/agent-chat/[id]` 时，`AgentChatProvider` 自动加载历史消息：

**加载逻辑（`agent-chat-context.tsx`）：**
```typescript
useEffect(() => {
  // 新对话页面时清空消息
  if (window.location.pathname === NEW_CHAT_PATH) {
    setMessages([]);
    return;
  }

  const fetchMessages = async () => {
    // 使用 authenticatedFetch 获取对话详情
    const response = await authenticatedFetch(`/api/conversations/${conversationId}`);

    if (response.ok) {
      const data = await response.json();
      // 使用 API 返回的 metadataContext（包含 contextLimit 和 modelName）
      const metadataContext = data.metadataContext;
      // 将数据库消息转换为 UIMessage 格式（含 metadata）
      const uiMessages = (data.messages || []).map((msg) =>
        dbMessageToUIMessage(msg, metadataContext)
      );
      setMessages(uiMessages);

      // 保存 checkpoint 信息（用于判断消息删除权限）
      if (data.checkpoint) {
        setCheckpointInfo({
          removedCount: data.checkpoint.removedCount,
          messagesAfterCheckpoint: data.checkpoint.messagesAfterCheckpoint,
        });
      }

      // 恢复 Agent ID（从对话记录中获取）
      if (data.conversation?.agent_id) {
        setSelectedAgentId(data.conversation.agent_id);
      }
    }
  };

  fetchMessages();
}, [conversationId, setMessages, authenticatedFetch]);
```

**消息格式转换：** 使用 `dbMessageToUIMessage`（`lib/agent-chat/utils.ts`）：
- 尝试解析 JSON 格式的消息内容
- 若解析失败则将纯文本包装为 `{ type: "text", text: content }` 格式
- 为 assistant 消息构造 `metadata`（包含 `usage`、`contextLimit`、`modelName`），用于 Context 组件显示 token 用量
- 支持 checkpoint 类型消息的转换

### 4.3 浏览器导航监听

监听浏览器前进/后退事件，确保切换历史会话时页面状态正确刷新：

```typescript
useEffect(() => {
  const handlePopState = () => {
    router.refresh(); // 刷新页面状态
  };
  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, [router]);
```

### 4.4 URL 更新机制

新对话首次发送消息后，自动将 URL 从 `/agent-chat` 更新为 `/agent-chat/[id]`：

**实现位置：** `AgentChatProvider` 的 `useChat` hook 的 `onFinish` 回调中

```typescript
const { messages, sendMessage, status, stop, setMessages } = useChat({
  transport,
  id: conversationId,
  onFinish: ({ finishReason, isAbort }) => {
    // 出错或中断时跳过非关键刷新
    if (finishReason === "error" || isAbort) return;
    // 刷新 checkpoint 信息
    refreshCheckpointInfo();
    // 刷新对话列表（确保新对话出现在侧边栏）
    fetchConversations();
    // 如果在新建对话页面，更新 URL 为具体对话地址
    if (!hasUpdatedUrl.current && window.location.pathname === NEW_CHAT_PATH) {
      hasUpdatedUrl.current = true;
      window.history.pushState({}, "", `/agent-chat/${conversationId}`);
    }
  },
});
```

**设计说明：** URL 更新和列表刷新已移至 `onFinish` 回调，确保在流式响应完成后执行，避免在消息发送过程中触发不必要的状态更新。使用 `hasUpdatedUrl` ref 标记避免重复更新。

### 4.5 移动端响应式设计

**侧边栏状态：**
- 移动端默认隐藏（`-translate-x-full`）
- 点击汉堡菜单按钮展开（`translate-x-0`）
- 桌面端始终显示（`md:relative md:translate-x-0`）

**遮罩层：**
- 侧边栏展开时显示半透明遮罩（`bg-black/50`）
- 点击遮罩关闭侧边栏
- 仅移动端显示（`md:hidden`）

**汉堡菜单按钮：**
- 仅移动端显示（`md:hidden`）
- 位于头部左侧

---

## 5. 使用指南

1. 打开 **`/agent-chat`**；选择 Agent；输入消息。
2. 从侧栏切换历史会话即导航到 **`/agent-chat/[id]`**，自动加载历史消息。
3. 登录/注册后入口统一 **`/agent-chat`**（见 `01登录注册鉴权说明.md`）。
4. Agent 配置 Skill 后，对话时自动加载 Skill 文件到沙盒并合并预置提示词。

---

## 6. 注意事项

1. **主入口不得再写为 `/chat`；旧路由已删除且无重定向，访问 `/chat` 为 404。**
2. **认证方式：** 仅支持 JWT Token 认证（`Authorization: Bearer ${accessToken}`），未登录用户无法访问（返回 401 错误）。前端通过 `useAuth` Hook 自动管理，无需手动判断。
3. **Token 自动刷新：** 使用 `authenticatedFetch()` 方法时，若 Token 过期（401 + TOKEN_EXPIRED），会自动刷新并重试请求。
4. `conversationId` 与认证头中的用户标识必须与权限校验一致，防止横向访问。
5. 工具侧当前为 **沙盒系统工具 + MCP 运行时工具 + Skill 预置提示词**，MCP 采用尽力模式挂载，单服务失败不阻断对话。
6. MCP 工具注入名直接使用经 `sanitizeName` 清洗后的原始工具名，唯一性由 Agent 配置时保证，运行时保留兜底冲突检测。
7. **Skill 系统工具依赖：** 创建带 Skill 的 Agent 时，系统自动强制包含 `bash`、`readFile`、`writeFile` 系统工具，确保 Agent 能读取和执行 Skill 文件。
8. **已有对话 Agent 选择限制：** 进入已有对话后，Agent 选择器会被禁用（`disabled={currentConversation !== undefined}`），防止中途更换 Agent。
9. **消息撤回限制：** 只能删除 checkpoint 之后的消息，不影响 `compression_cache`。删除的消息归档到 `deleted_messages` 表，保留原消息内容便于排查。
10. **会话压缩设计：** 压缩任务采用异步调度，每个会话只能有1个未处理任务（数据库唯一约束）。压缩后移除50%的最早消息，保留至少1条。
11. **编辑重发功能已移除：** 原 `/api/messages/[id]/edit-regenerate` API 已删除，不再支持消息编辑后重新生成。
12. **Token 统计字段：** messages 表的 Token 字段仅 assistant 消息有值，user 消息为 NULL。conversations 表汇总所有消息的 Token 消耗。

---

## 7. 相关文件清单

### 前端页面与布局

| 路径 | 说明 |
|------|------|
| `app/agent-chat/page.tsx` | 新会话页 |
| `app/agent-chat/[id]/page.tsx` | 会话详情页 |
| `app/agent-chat/layout.tsx` | 布局 |

### 前端组件（Context + 组合子组件模式）

| 路径 | 说明 |
|------|------|
| `components/agent-chat/agent-chat-client.tsx` | 组合组件入口，组装 Provider + Frame + Header + Conversation + Input + Dialogs |
| `components/agent-chat/agent-chat-context.tsx` | `AgentChatProvider`：全局状态管理（Context + Provider 模式） |
| `components/agent-chat/agent-chat-frame.tsx` | 外层布局容器（侧边栏 + 主对话区） |
| `components/agent-chat/agent-chat-header.tsx` | 顶部导航（Context 组件 + Agent 选择器 + 用户菜单） |
| `components/agent-chat/agent-chat-conversation.tsx` | 消息列表区域（渲染消息、工具调用、Checkpoint 分割线） |
| `components/agent-chat/agent-chat-input.tsx` | 输入区域（封装 `PromptSection`） |
| `components/agent-chat/message-actions.tsx` | 消息操作栏（`AssistantMessageActions`、`UserMessageActions`、`MessageActions`） |
| `components/agent-chat/agent-chat-dialogs.tsx` | 确认对话框（删除确认、编辑确认） |
| `components/agent-chat/sidebar.tsx` | 历史对话侧栏 |
| `components/agent-chat/db-agent-selector.tsx` | Agent 选择器 |
| `components/agent-chat/prompt-section.tsx` | 输入框组件 |
| `components/agent-chat/index.ts` | 组件导出 |

### 后端业务模块（lib/agent-chat/）

| 路径 | 说明 |
|------|------|
| `lib/agent-chat/index.ts` | 业务模块统一导出 |
| `lib/agent-chat/types.ts` | 类型定义（Result 模式：ok/error） |
| `lib/agent-chat/request.ts` | 请求解析（parseChatRequestBody） |
| `lib/agent-chat/auth-context.ts` | 认证验证（getAuthContext） |
| `lib/agent-chat/agent-loader.ts` | Agent 配置加载与权限验证（loadAgentConfig） |
| `lib/agent-chat/model-resolver.ts` | 模型解析与构建（resolveModel、wrapModel、buildChatModelFromUserModel） |
| `lib/agent-chat/conversation.ts` | 会话管理（ensureConversation、loadHistory、saveUserMessage） |
| `lib/agent-chat/runtime.ts` | 运行时创建与 Agent 执行（createRuntime、executeAgent） |
| `lib/agent-chat/response.ts` | 流式响应构建与消息落库（buildStreamResponse） |
| `lib/agent-chat/utils.ts` | 消息格式转换工具函数（dbMessageToUIMessage、isToolPart 等） |

### API 路由

| 路径 | 说明 |
|------|------|
| `app/api/agent-chat/route.ts` | 对话 API 入口（组装者，调用 `lib/agent-chat` 模块） |
| `app/api/agent-conversations/route.ts` | 列表 API |
| `app/api/conversations/[id]/route.ts` | 已有会话消息获取 API |
| `app/api/messages/[id]/delete/route.ts` | 消息撤回 API（级联删除） |

### 基础设施与工具库

| 路径 | 说明 |
|------|------|
| `app/settings/token-test/page.tsx` | Token 估算测试页面 |
| `lib/hooks/use-auth.ts` | 认证状态管理 Hook |
| `lib/agents/mcp-runtime.ts` | MCP 运行时工具构建（适配器，桥接 lib/infra/mcp） |
| `lib/agents/toolset-merge.ts` | 工具集合合并 |
| `lib/db/agents.ts` | Agent 数据访问层（含 Skill 关联） |
| `lib/db/message-retract.ts` | 消息撤回模块（归档+删除） |
| `lib/db/compression.ts` | 会话压缩任务管理（任务+Checkpoint CRUD） |
| `lib/infra/mcp/runtime.ts` | MCP 运行时实现（尽力模式、工具注入、连接管理） |
| `lib/infra/mcp/interface.ts` | MCP 接口抽象（配置、诊断、结果类型定义） |
| `lib/infra/mcp/index.ts` | MCP 模块统一导出 |
| `lib/infra/sandbox/config.ts` | 沙盒配置 |
| `lib/infra/sandbox/factory.ts` | 沙盒工厂 |
| `lib/infra/sandbox/interface.ts` | 沙盒接口抽象 |
| `lib/infra/sandbox/path-validator.ts` | 沙盒路径校验 |
| `lib/infra/sandbox/session-manager.ts` | 沙盒会话管理 |
| `lib/infra/sandbox/skill-loader.ts` | Skill 运行时加载器 |
| `lib/infra/sandbox/tools.ts` | 沙盒工具定义 |
| `lib/infra/sandbox/types.ts` | 沙盒类型定义 |
| `lib/infra/sandbox/index.ts` | 沙盒模块统一导出 |
| `lib/infra/model/token-estimation.ts` | Token 估算函数 |
| `lib/infra/model/middleware.ts` | 模型压缩检测中间件 |
| `lib/infra/user/middleware.ts` | 认证中间件（仅 JWT） |
| `lib/infra/user/jwt.ts` | JWT 令牌工具函数 |
| `lib/infra/user/auth-service.ts` | 认证服务 |
| `lib/schemas/conversation.ts` | 对话与消息表结构定义（conversations、messages 表及类型） |
| `lib/schemas/system.ts` | 系统相关表结构定义（compression_tasks、checkpoints、deleted_messages 表及类型） |

**创建时间：** 2026-03-28
**最后更新：** 2026-04-30
**版本：** v3.0