# 系统内置 Tool 说明

> **文档目的：** 说明平台内置「系统工具」的 id 约定、能力范围、注册表机制，以及与 Agent `enabledSystemTools`、聚合接口 `/api/tools` 的关系。
> **系统概述：** 系统工具不依赖用户 MCP，id 以 **`system:`** 为前缀；与 MCP 工具一起在 **`GET /api/tools`** 中合并返回。Agent 可通过 **`enabledSystemTools`** 声明启用哪些系统工具（与 MCP tool id 并列由业务层消费）。工具注册表（`ToolRegistry`）支持动态注册、查找和冲突处理，支持 Tavily 搜索、沙盒工具、MCP 工具等多种类型。
> **技术栈：** Next.js、`app/api/tools/route.ts`、`lib/infra/tools/` 工具模块、`lib/infra/sandbox/` 沙盒模块、`lib/schemas/tool.ts` 类型定义

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

```
GET /api/tools
  ├─ SYSTEM_TOOLS_META（内存常量，source: system，来自 lib/infra/tools/system.ts）
  └─ 用户 MCP 工具（DB 联接查询，source: mcp）

ToolRegistry（内存注册表，来自 lib/infra/tools/registry.ts）
  ├─ 动态注册：registerTool() / registerAll()
  ├─ 查找：getTool() / hasTool() / getAllTools()
  ├─ 创建实例：createTools()
  ├─ 注销：unregisterTool()
  └─ 冲突策略：warn（默认）/ error / overwrite

工具初始化模块（来自 lib/infra/tools/init.ts）
  ├─ initTools(toolNames)：按需初始化指定工具
  ├─ initAllTools()：初始化所有内置工具
  ├─ registerTavilyTool()：注册 Tavily 搜索工具
  ├─ registerSandboxTool()：注册沙盒工具
  └─ registerMcpTool()：注册 MCP 工具

系统工具常量（来自 lib/infra/tools/system.ts）
  ├─ SYSTEM_TOOL_IDS：['system:sandbox:bash', 'system:sandbox:readFile', 'system:sandbox:writeFile']
  ├─ SYSTEM_TOOLS_META：完整元数据列表
  └─ 工具函数：parseSystemTools / serializeSystemTools / validateSystemToolIds / isSystemToolId
```

| 模块 | 路径 | 职责 |
|------|------|------|
| 系统工具常量 | `lib/infra/tools/system.ts` | 定义 `SYSTEM_TOOLS_META`、`SYSTEM_TOOL_IDS`，提供验证/序列化函数 |
| 工具注册表 | `lib/infra/tools/registry.ts` | 工具注册表类 `ToolRegistry`，支持动态注册/查找/冲突处理 |
| 工具初始化 | `lib/infra/tools/init.ts` | 预注册所有内置工具定义（Tavily、Sandbox、MCP），提供 `initTools` / `initAllTools` |
| 工具服务接口 | `lib/infra/tools/service.ts` | 定义 `ToolService` 接口，提供统一的工具注册和创建能力 |
| 工具类型定义 | `lib/infra/tools/types.ts` | `ToolType`、`ToolDefinition`（扩展版）、`ToolConflictStrategy` 等类型 |
| 沙盒工具创建器 | `lib/infra/tools/sandbox.ts` | 创建 Sandbox 工具的入口函数 |
| 工具模块导出 | `lib/infra/tools/index.ts` | 统一导出注册表、类型、初始化函数 |
| 聚合 API | `app/api/tools/route.ts` | 合并系统工具与 DB MCP 工具，返回工具列表 |
| Agent API | `app/api/agents/**` | 创建/更新 Agent 时读写 `enabledSystemTools` |
| Agent DB | `lib/db/agents.ts` | 持久化 Agent 与工具字段 |
| 沙盒接口抽象 | `lib/infra/sandbox/interface.ts` | 定义 `SandboxSessionInterface`、`SandboxToolProviderInterface` 等接口 |
| 沙盒工厂 | `lib/infra/sandbox/factory.ts` | 工厂函数创建沙盒实例和工具提供者，支持 mock 注入 |
| 沙盒工具 | `lib/infra/sandbox/tools.ts` | 创建沙盒工具（bash、readFile、writeFile） |
| 沙盒类型定义 | `lib/infra/sandbox/types.ts` | `ExecResult`、`SessionState`、`ExecParams` 等类型 |
| 类型定义 | `lib/schemas/tool.ts` | `SystemTool`、`Tool`、`McpServer`、`UserSkill` 等类型定义 |

---

## 2. 数据库设计

系统工具 **无独立表**；Agent 侧 `enabled_system_tools` 列存储系统工具 id JSON 数组，解析和序列化由 `lib/infra/tools/system.ts` 中的 `parseSystemTools` / `serializeSystemTools` 处理。

MCP 工具仍存 **`mcp_tools`** + **`user_mcp_servers`**。

### 2.1 Skill 相关表

| 表名 | 说明 |
|------|------|
| `user_skills` | 用户 Skill 元数据（name、description、metadata、storage_path、file_hash、file_size、file_count） |
| `agent_skills` | Agent 与 Skill 多对多关联（agent_id、skill_id，UNIQUE 约束） |

类型定义位于 `lib/schemas/tool.ts`（含 `UserSkill`、`AgentSkill`、`CreateUserSkillParams`、`UpdateUserSkillParams`、`SkillValidationResult`、`UserSkillWithAgentCount`）。  
数据访问层位于 `lib/db/skills.ts`。

### 2.2 类型定义迁移

- **`SystemTool`** 类型从原 `lib/db/schema.ts` 迁移至 `lib/schemas/tool.ts`
- **`Tool`** 统一工具类型（`source: 'system' | 'mcp'`）也定义于 `lib/schemas/tool.ts`
- **`ToolType`**（`'tavily' | 'mcp'`）定义于 `lib/infra/tools/types.ts`

---

## 3. 后端实现

### 3.1 `SYSTEM_TOOLS` 常量（`lib/infra/tools/system.ts`）

系统工具常量定义于 `lib/infra/tools/system.ts`：

| 导出 | 说明 |
|------|------|
| `SYSTEM_TOOL_IDS` | 系统工具 ID 只读数组：`['system:sandbox:bash', 'system:sandbox:readFile', 'system:sandbox:writeFile']` |
| `SystemToolId` | ID 联合类型 |
| `SYSTEM_TOOLS_META` | 完整元数据数组（含 id、name、description、inputSchema、source、isAvailable） |
| `SystemToolMeta` | 元数据接口类型 |
| `getDefaultSystemTools()` | 返回默认系统工具 ID 数组副本 |
| `validateSystemToolIds(ids)` | 过滤有效系统工具 ID |
| `parseSystemTools(jsonStr)` | 从 JSON 字符串解析系统工具 ID（失败时回退默认值） |
| `serializeSystemTools(ids)` | 序列化系统工具 ID 为 JSON 字符串 |
| `isSystemToolId(id)` | 判断是否为系统工具 ID（`system:` 前缀） |

当前内置项：

| id | name | 说明 |
|----|------|------|
| `system:sandbox:bash` | bash | 在沙盒环境中执行bash命令 |
| `system:sandbox:readFile` | readFile | 读沙盒工作区文件 |
| `system:sandbox:writeFile` | writeFile | 写沙盒工作区文件 |

### 3.2 工具注册表（`lib/infra/tools/registry.ts`）

`ToolRegistry` 类提供动态注册机制：

| 方法 | 说明 |
|------|------|
| `register(definition, strategy?)` | 注册工具，支持冲突策略（`warn`/`error`/`overwrite`） |
| `registerAll(definitions, strategy?)` | 批量注册 |
| `get(name)` / `has(name)` | 查找工具 |
| `getAll()` / `getNames()` | 获取所有注册工具 |
| `unregister(name)` | 注销工具 |
| `clear()` | 清空注册表 |
| `create(name)` | 创建单个工具实例（调用 `definition.create()`） |
| `createAll(names)` | 批量创建，合并工具集合和清理函数 |

全局便捷函数：`registerTool`、`getTool`、`getAllTools`、`hasTool`、`unregisterTool`、`createTools`、`getGlobalRegistry`、`clearGlobalRegistry`。

#### 冲突处理策略

| 策略 | 行为 |
|------|------|
| `warn`（默认） | 打印警告并跳过，保留已注册工具 |
| `error` | 返回错误结果，阻止注册 |
| `overwrite` | 覆盖已存在的工具 |

`lib/infra/tools/types.ts` 中还定义了扩展的 `ToolConflictStrategy` 类型：`'error' | 'skip' | 'override' | 'warn'`，供注册表高级模式使用。

### 3.3 Tavily 搜索工具（`lib/infra/tools/init.ts`）

Tavily 工具定义已整合到 `init.ts` 中，不再使用独立文件：

- **ToolType** 包含 `'tavily'` 类型（定义于 `types.ts`）
- 通过 `registerTavilyTool()` 注册到全局注册表
- 工具定义包含 `create` 函数，动态导入 `@tavily/ai-sdk`
- 配置参数：`searchDepth: 'basic'`、`includeAnswer: true`、`maxResults: 5`、`topic: 'general'`
- 依赖包：`@tavily/ai-sdk`
- 注册时使用 `overwrite` 策略，避免重复注册冲突

### 3.4 沙盒工具创建器

沙盒工具创建涉及两个文件：

| 文件 | 函数 | 说明 |
|------|------|------|
| `lib/infra/tools/sandbox.ts` | `createSandboxTools()` | 无参数版本，简单导出层，调用底层模块 |
| `lib/infra/sandbox/tools.ts` | `getSandboxToolsWithContext(context)` | **推荐使用**，带上下文绑定，返回完整 ToolSet |
| `lib/infra/sandbox/tools.ts` | `createSandboxTools()` | 无参数版本，**已废弃（@deprecated）**，返回空对象 |

**上下文绑定机制：**
- `SandboxToolContext` 包含 `conversationId` 和 `userId`
- 带上下文版本通过闭包绑定，在工具创建时注入会话信息
- 无参数版本无法获取上下文，工具执行时会失败

**推荐用法：**
```typescript
import { getSandboxToolsWithContext, SandboxToolContext } from '@/lib/infra/sandbox';

const context: SandboxToolContext = { conversationId, userId };
const sandboxTools = getSandboxToolsWithContext(context);  // ✅ 推荐
```

### 3.5 沙盒接口与工厂（`lib/infra/sandbox/interface.ts` / `factory.ts`）

**接口定义（`interface.ts`）：**

| 接口 | 说明 |
|------|------|
| `SandboxSessionInterface` | 沙盒操作核心接口：`exec`、`readFile`、`writeFile`、`heartbeat`、`getStatus` |
| `SandboxToolProviderInterface` | 工具提供者接口：`getToolsWithContext(context)`、`isAvailable()` |
| `SandboxInstance` | 完整实例 = `session` + `toolProvider` |
| `SandboxCreationConfig` | 创建配置：`config: SandboxConfig`、`enabled: boolean` |
| `SandboxToolContext` | 工具执行上下文：`conversationId`、`userId` |

**工厂函数（`factory.ts`）：**

| 函数 | 说明 |
|------|------|
| `createSandboxInstance(config?)` | 创建完整沙盒实例（会话 + 工具提供者） |
| `createSandboxSession(config?)` | 创建会话实例 |
| `createSandboxToolProvider(session?, config?)` | 创建工具提供者 |
| `setMockSandboxSession(session)` / `setMockToolProvider(provider)` | 注入 mock（测试用） |
| `clearAllMocks()` | 清除所有 mock |

### 3.6 工具初始化模块（`lib/infra/tools/init.ts`）

工具初始化模块提供预注册所有内置工具定义的能力：

| 导出 | 说明 |
|------|------|
| `initTools(toolNames)` | 按需初始化指定工具，根据工具名称列表注册对应的工具定义 |
| `initAllTools()` | 初始化所有内置工具（Tavily、Sandbox、MCP） |
| `registerTavilyTool()` | 注册 Tavily 搜索工具到全局注册表 |
| `registerSandboxTool()` | 注册沙盒工具到全局注册表 |
| `registerMcpTool()` | 注册 MCP 工具到全局注册表 |

**内置工具定义：**

| 工具名称 | 说明 | 创建函数 |
|----------|------|----------|
| `tavily` | Tavily 网络搜索工具 | 动态导入 `@tavily/ai-sdk`，返回 `tavilySearch` 工具 |
| `sandbox` | 沙盒环境工具（bash、文件读写） | 空实现，需通过 `createSandboxTools` 单独创建 |
| `mcp` | MCP 远程工具 | 空实现，待后续实现 |

**使用场景：**
- 应用启动时调用 `initAllTools()` 预注册所有工具
- 根据配置按需调用 `initTools(['tavily', 'sandbox'])` 注册特定工具
- 工具注册后可通过 `createTools(names)` 批量创建实例

### 3.7 工具服务接口（`lib/infra/tools/service.ts`）

`ToolService` 接口定义统一的工具注册和创建能力：

| 方法 | 说明 |
|------|------|
| `register(definition, strategy?)` | 注册工具定义 |
| `registerAll(definitions, strategy?)` | 批量注册工具定义 |
| `create(name)` | 创建单个工具实例 |
| `createAll(names)` | 批量创建工具实例 |
| `get(name)` | 查找工具定义 |
| `getAll()` | 获取所有已注册工具 |
| `has(name)` | 检查工具是否存在 |

**设计说明：**
- `ToolService` 是纯接口定义，未提供默认实现
- 旨在为依赖注入和测试提供统一抽象
- 实际实现可基于 `ToolRegistry` 类封装

### 3.8 `GET /api/tools`

1. **`authenticateRequestOptional`**：须能解析 `userId`（匿名或登录）。  
2. 查询当前用户 **已启用且在线** 的 MCP 工具。  
3. 与 **`SYSTEM_TOOLS_META`** 合并、按名称排序返回 `{ tools, stats }`。

### 3.9 Agent 与 `enabledSystemTools`

- **`POST /api/agents`、`PUT /api/agents/[id]`** 请求体可带 **`enabledSystemTools`**：`string[]`（系统工具 id）。  
- 由 **`lib/db/agents`** 与 **`app/api/agents/**`** 校验并存储，使用 `parseSystemTools` / `serializeSystemTools` 处理序列化。

---

## 4. 前端实现

- **`app/settings/tools`**：展示聚合工具列表（消费 `/api/tools`）。  
- **`app/settings/agents`**：编辑 Agent 时勾选系统工具 / MCP 工具（与后端字段一致）。

---

## 5. 使用指南

1. 在 Agent 配置中勾选需要的 **`system:sandbox:*`** 工具（若 UI 暴露）。
2. 确保 **沙盒已正确启用**（`SANDBOX_ENABLED=true` 且 Gateway 可用），否则对话中执行可能失败。
3. 使用 **`GET /api/tools`** 调试当前用户可见的全集。
4. 使用 **`ToolRegistry`** 动态注册自定义工具：调用 `registerTool(definition)` 注册，选择合适的冲突处理策略。
5. 使用 **`createTools(names)`** 批量创建工具实例，返回合并 ToolSet 和清理函数。
6. 使用 **`initAllTools()`** 预注册所有内置工具，或使用 **`initTools(['tavily'])`** 按需注册。
7. 使用 **`getSandboxToolsWithContext(context)`** 创建沙盒工具集（需传入 conversationId 和 userId）。

---

## 6. 注意事项

1. **id 必须以 `system:` 前缀** 与 MCP 工具 id 区分，`isSystemToolId()` 可用于运行时判断。
2. 聚合列表里的 `isAvailable` 对 MCP 依赖服务器在线状态；系统工具在路由层为 `true`，与实际运行时错误需区分对待。
3. Agent Chat 当前 **`app/api/agent-chat/route.ts`** 若仅注入沙盒工具，具体子集是否与 `enabledSystemTools` 完全一致，以该路由与 `lib/infra/tools` 实现为准。
4. **注册表冲突处理**：默认策略为 `warn`（跳过），注册同名工具不会覆盖；如需覆盖使用 `overwrite` 策略或 `ToolConflictStrategy.override`；如需严格校验使用 `error` 策略。
5. **ToolType 扩展**：`ToolType` 当前为 `'tavily' | 'mcp'`，新增工具类型时需在此联合类型中添加，并通过注册表注册对应工具定义。
6. **模块迁移**：工具模块已从 `lib/agents/tools/` 迁移至 `lib/infra/tools/`，沙盒模块已从 `lib/sandbox/` 迁移至 `lib/infra/sandbox/`，系统工具常量已从 `lib/constants/system-tools.ts` 迁移至 `lib/infra/tools/system.ts`，导入路径需更新。
7. **类型定义迁移**：`SystemTool` 类型从 `lib/db/schema.ts` 迁移至 `lib/schemas/tool.ts`，导入路径需更新。
8. **沙盒工厂模式**：推荐使用 `createSandboxInstance()` 创建完整实例，测试时可通过 `setMockSandboxSession()` / `setMockToolProvider()` 注入 mock。
9. **MCP 工具模块状态**：`init.ts` 中定义了 `mcpToolDefinition` 但 `create` 函数返回空对象，MCP 工具的实际创建和注册机制待后续实现。
10. **ToolDefinition 双版本**：`registry.ts` 中定义了简化版 `ToolDefinition`（name、description、create、metadata），`types.ts` 中定义了扩展版（name、type、creator、description、dependencies），根据使用场景选择合适的版本。
11. **工具初始化时机**：建议在应用启动时调用 `initAllTools()` 或 `initTools()` 预注册工具定义，运行时通过 `createTools()` 创建实例。

---

## 7. 相关文件清单

| 路径 | 说明 |
|------|------|
| `lib/infra/tools/system.ts` | 系统工具 ID 常量、元数据、验证/序列化函数 |
| `lib/infra/tools/registry.ts` | `ToolRegistry` 工具注册表 |
| `lib/infra/tools/init.ts` | 工具初始化模块，预注册所有内置工具定义 |
| `lib/infra/tools/service.ts` | `ToolService` 接口定义 |
| `lib/infra/tools/types.ts` | `ToolType`、`ToolDefinition`（扩展版）、`ToolConflictStrategy` 等类型定义 |
| `lib/infra/tools/sandbox.ts` | 沙盒工具导出层（无参数版本，推荐使用 `lib/infra/sandbox/tools.ts` 的带上下文版本） |
| `lib/infra/tools/index.ts` | 工具模块统一导出 |
| `lib/infra/sandbox/interface.ts` | 沙盒接口抽象（SandboxSessionInterface、SandboxToolProviderInterface 等） |
| `lib/infra/sandbox/factory.ts` | 沙盒工厂函数（createSandboxInstance 等，支持 mock 注入） |
| `lib/infra/sandbox/tools.ts` | 沙盒工具创建核心（`getSandboxToolsWithContext()` 带上下文版本，推荐使用） |
| `lib/infra/sandbox/types.ts` | 沙盒类型定义（ExecResult、SessionState 等） |
| `lib/infra/sandbox/config.ts` | 沙盒配置管理 |
| `lib/infra/sandbox/session-manager.ts` | 沙盒会话管理器 |
| `lib/infra/sandbox/path-validator.ts` | 沙盒路径验证 |
| `lib/infra/sandbox/skill-loader.ts` | 沙盒 Skill 加载器 |
| `lib/infra/sandbox/index.ts` | 沙盒模块统一导出 |
| `lib/schemas/tool.ts` | SystemTool、Tool、McpServer、UserSkill 等类型定义 + Skill 表结构 SQL |
| `lib/db/skills.ts` | Skill 数据访问层（CRUD + Agent 关联管理） |
| `lib/db/agents.ts` | Agent 持久化（含 enabled_system_tools 序列化） |
| `app/api/tools/route.ts` | 工具聚合 API（使用 SYSTEM_TOOLS_META 常量） |
| `app/api/agents/route.ts` | 创建 Agent，`enabledSystemTools` |
| `app/api/agents/[id]/route.ts` | 更新 Agent |

---

## 8. 已知问题与修复记录

### 8.1 AI SDK 5.0+ 工具参数 Schema 问题（2026-05-01）

**问题描述：**
- 使用沙盒工具（bash、readFile、writeFile）时返回 HTTP 422 错误
- 工具定义在前端显示为空的 `parameters: {}`

**根因分析：**
AI SDK 5.0+ 将工具定义的 `parameters` 属性重命名为 `inputSchema`。旧代码使用 `parameters` 定义工具 schema，导致：
1. AI SDK 无法正确解析工具参数定义
2. 工具调用时参数为空对象，沙盒 Gateway 校验失败返回 422

**修复方案：**
将所有工具定义中的 `parameters` 属性改为 `inputSchema`：

```typescript
// 错误写法（AI SDK 4.x）
const bashTool = tool({
  description: '在沙盒环境中执行bash命令',
  parameters: z.object({ command: z.string() }),  // ❌ 旧属性名
  execute: async ({ command }) => { ... }
});

// 正确写法（AI SDK 5.0+）
const bashTool = tool({
  description: '在沙盒环境中执行bash命令',
  inputSchema: z.object({ command: z.string() }),  // ✅ 新属性名
  execute: async ({ command }) => { ... }
});
```

**涉及文件：**
- `lib/infra/sandbox/tools.ts` - 沙盒工具定义
- `lib/infra/skills/skill-tool.ts` - Skill 工具定义
- `lib/infra/skills/skill-service.ts` - Skill 服务层工具创建

**验证方法：**
检查工具定义在前端 UI 中的显示，确认 `parameters`（或 `inputSchema`）包含完整的 schema 定义而非空对象。

### 8.2 工具上下文传递机制问题（2026-05-01）

**问题描述：**
沙盒工具执行时无法获取 `conversationId` 和 `userId`，导致：
- 沙盒 session 无法正确创建
- Gateway API 调用失败

**根因分析：**
原实现尝试通过 `experimental_context` 在 `stream()` 调用时传递上下文：
```typescript
// 错误方式：尝试通过 stream() 传递上下文
await agent.stream({
  messages,
  experimental_context: { conversationId, userId }  // ❌ ToolLoopAgent 不支持
});
```

但 AI SDK 的 `ToolLoopAgent.stream()` **不支持** `experimental_context` 参数，该参数仅存在于 `streamText()` 等底层 API。上下文无法传递到工具的 `execute` 函数。

**修复方案：**
改用闭包绑定，在工具创建时注入上下文：

```typescript
// 正确方式：闭包绑定上下文
export interface SandboxToolContext {
  conversationId: string;
  userId: string;
}

function createBashTool(context: SandboxToolContext) {
  return tool({
    description: '在沙盒环境中执行bash命令',
    inputSchema: z.object({ command: z.string() }),
    execute: async ({ command }) => {
      // 上下文从闭包获取，而非 experimental_context
      const sandboxManager = getSandboxManager();
      await sandboxManager.exec({
        sessionId: context.conversationId,  // ✅ 闭包访问
        userId: context.userId,              // ✅ 闭包访问
        code: command,
        language: 'bash',
      });
    },
  });
}

// 导出工厂函数，供外部使用
export function getSandboxToolsWithContext(context: SandboxToolContext): ToolSet {
  return {
    bash: createBashTool(context),
    readFile: createReadFileTool(context),
    writeFile: createWriteFileTool(context),
  };
}
```

**调用方改造：**

```typescript
// agent-chat (lib/agent-chat/runtime.ts)
const sandboxContext: SandboxToolContext = {
  conversationId,
  userId,
};
const sandboxTools = getSandboxToolsWithContext(sandboxContext);

// workflowchat (lib/workflowchat/agent-tools.ts)
const sandboxContext: SandboxToolContext = {
  conversationId,
  userId,
};
const sandboxTools = getSandboxToolsWithContext(sandboxContext);
```

**涉及文件：**
- `lib/infra/sandbox/tools.ts` - 新增 `getSandboxToolsWithContext()` 函数
- `lib/infra/sandbox/index.ts` - 导出新函数和类型
- `lib/infra/skills/skill-service.ts` - 新增 `createSkillToolWithContext()` 函数
- `lib/infra/skills/index.ts` - 导出新函数和类型
- `lib/agent-chat/runtime.ts` - 改用闭包绑定方式创建工具
- `lib/workflowchat/agent-tools.ts` - 改用闭包绑定方式创建工具

**设计原则：**
> 工具上下文应在工具创建时通过闭包绑定，而非在执行时通过参数传递。这是 AI SDK 工具系统的设计模式，确保工具的 `execute` 函数能直接访问所需上下文。

### 8.3 停止按钮无效问题（2026-05-01）

**问题描述：**
用户点击停止按钮后，前端停止消费 stream，但后端 Agent/Workflow 循环继续执行，浪费资源。

**根因分析：**
- **agent-chat**：前端 `stop()` 仅取消 stream 消费，未传递取消信号到后端
- **workflowchat**：Workflow SDK 的 run 需要显式调用 `cancel()` 方法终止

**修复方案：**

**agent-chat：传递 AbortSignal**
```typescript
// lib/agent-chat/runtime.ts - executeAgent 增加 abortSignal 参数
export async function executeAgent(
  wrappedModel: LanguageModel,
  systemPrompt: string,
  tools: ToolSet,
  history: UIMessage[],
  message: UIMessage,
  agent: AgentWithTools,
  experimentalContext?: unknown,
  abortSignal?: AbortSignal  // ✅ 新增参数
): Promise<StreamTextResult<ToolSet, never>> {
  const agentInstance = new ToolLoopAgent({
    model: wrappedModel,
    instructions: systemPrompt,
    tools,
    stopWhen,
  });
  // 传递 abortSignal 到 stream()
  const result = await agentInstance.stream({
    messages: modelMessages,
    abortSignal,  // ✅ AI SDK 会终止 Agent 循环
  });
  return result;
}

// app/api/agent-chat/route.ts - 传递 req.signal
const result = await executeAgent(
  wrappedModel, runtime.systemPrompt, runtime.tools,
  history.messages, body.data.message, agent.agent,
  undefined, req.signal  // ✅ 传递请求的 abort signal
);
```

**workflowchat：创建 Cancel API**
```typescript
// app/api/workflowchat/conversations/[id]/runs/[runId]/cancel/route.ts
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: conversationId, runId: workflowRunId } = await params;
  
  // 验证权限...
  
  // 获取 Workflow Run 句柄并调用 cancel
  const workflowRun = await getRun(workflowRunId);
  await workflowRun.cancel();  // ✅ 终止 Workflow 执行
  
  // 清除 active_stream_id
  await reconcileExistingActiveStream(conversationId);
  
  return NextResponse.json({ message: 'Run 已取消', workflowRunId });
}
```

**前端改造：**
```typescript
// workflow-chat-client.tsx - 停止按钮调用 cancel API
const handleStop = async () => {
  stop();  // 前端停止 stream 消费
  
  const runId = currentRunIdRef.current;
  if (runId) {
    // 调用后端 cancel API
    await authenticatedFetch(
      `/api/workflowchat/conversations/${conversationId}/runs/${runId}/cancel`,
      { method: "POST" }
    );
  }
};
```

**涉及文件：**
- `lib/agent-chat/runtime.ts` - executeAgent 增加 abortSignal 参数
- `app/api/agent-chat/route.ts` - 传递 req.signal 到 executeAgent
- `app/api/workflowchat/conversations/[id]/runs/[runId]/cancel/route.ts` - 新建 cancel API
- `app/workflowchat/_components/workflow-chat-client.tsx` - 停止按钮调用 cancel API

**验证方法：**
点击停止按钮后，检查后端日志确认 Agent/Workflow 执行已终止，而非继续运行。

---

**创建时间：** 2026-03-28
**版本：** v1.5
**最后更新：** 2026-05-01（修复使用指南中沙盒工具函数名错误：createSandboxTools → getSandboxToolsWithContext）