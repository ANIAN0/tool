# MCP 与 MCP Tool 注册说明

> **文档目的：** 说明用户如何注册 MCP 服务、同步工具列表、检测在线状态。  
> **系统概述：** MCP 服务存于 `user_mcp_servers`，工具存于 `mcp_tools`。所有 API 路由使用 **JWT 鉴权**，用户需通过 `Authorization: Bearer <token>` 传递有效的 JWT 访问令牌。  
> **技术栈：** Next.js Route Handlers、`@ai-sdk/mcp`（通过 `createMCPClient` 走 HTTP transport）、`lib/infra/user/middleware.ts`（`authenticateRequest`、`authenticateRequestOptional`）

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
| 认证模块 | `lib/infra/user/middleware.ts`、`jwt.ts`、`server.ts` | JWT 鉴权（`authenticateRequest`、`authenticateRequestOptional`、`withAuth`） |
| MCP CRUD | `app/api/mcp/route.ts`、`app/api/mcp/[id]/route.ts` | 列表、创建、读、改、删（JWT 鉴权） |
| 工具列表 | `app/api/mcp/[id]/tools/route.ts` | 某服务下的工具缓存 |
| 状态 | `app/api/mcp/[id]/status/route.ts` | 连通性 / 在线检测 |
| 统一工具 API | `app/api/tools/route.ts` | 合并返回系统工具 + MCP 工具列表 |
| 数据层 | `lib/db` 内 MCP 相关 | 持久化 |
| 迁移（未使用） | `lib/db/mcp.ts` | `migrateMcpData(fromUserId, toUserId)`（函数存在但当前未被调用） |
| MCP 运行时 | `lib/infra/mcp/` | 接口抽象 + 运行时实现（配置由调用方传入） |
| 工具注册表 | `lib/infra/tools/` | 工具注册、创建、初始化、系统工具定义 |
| MCP 适配器 | `lib/agents/mcp-runtime.ts` | 桥接外部配置与 MCP 运行时（不查数据库） |
| Agent Chat 运行时 | `lib/agent-chat/runtime.ts` | Agent Chat 运行时 MCP 工具挂载 |

**身份解析：** 当前所有 MCP 路由使用 JWT 鉴权，通过 `Authorization: Bearer <token>` 传递访问令牌。底层 `getAuthContext`（`lib/infra/user/middleware.ts`）从请求头提取 JWT 并验证有效性，解析出 `userId`。无有效令牌时返回 401。

---

## 2. 数据库设计

见 `lib/schemas/tool.ts`（从原 `lib/db/schema.ts` 拆分）：

- **`user_mcp_servers`**：id、url、headers（JSON）、is_enabled、status、error_message、`user_id` 等。  
- **`mcp_tools`**：id、关联 `server_id`（外键）、name、description、`input_schema`（JSON）、`is_available` 等。

`lib/db/mcp.ts` 中的 `migrateMcpData` 函数可执行 `UPDATE user_mcp_servers SET user_id = ? WHERE user_id = ?`，工具通过 server 外键随服务器归属一并迁移。但该函数当前未被任何路由调用，属于历史遗留代码。

---

## 3. 后端实现

### 3.1 鉴权模式

- **`authenticateRequest`**：必须登录才能访问的 API 端点，无有效 JWT 令牌时返回 401。
- **`authenticateRequestOptional`**：名称中的 "Optional" 为历史遗留，当前实现与 `authenticateRequest` 行为一致——无有效 JWT 令牌时同样返回 401，**不允许匿名访问**。
- **`withAuth`**：高阶函数包装器，用于 route handler，验证 JWT 后将 `userId` 注入 context。
- 所有 MCP 路由均绑定到已验证的 **`userId`**。

### 3.2 登录 / 注册

- **`app/api/auth/login/route.ts`**：验证用户名和密码，成功后颁发 JWT 令牌对（access + refresh），并设置 httpOnly cookie。
- **`app/api/auth/register/route.ts`**：验证邀请码、用户名和密码格式，创建新用户后颁发 JWT 令牌对。
- 两个路由均 **不处理** 匿名用户迁移——系统已不支持匿名用户升级，所有用户必须通过注册创建。
- **`lib/db/mcp.ts` 中的 `migrateMcpData` 函数**：代码存在（执行 `UPDATE user_mcp_servers SET user_id = ? WHERE user_id = ?`），但当前无任何路由调用，属于历史遗留代码。

### 3.3 MCP 协议 SDK 选型（当前实现）

- 当前项目在服务端状态检查与工具同步中，使用的是 **`@ai-sdk/mcp`**（`createMCPClient`）。  
- 当前实现 **没有** 直接接入 `modelcontextprotocol/typescript-sdk`。  
- 因此文档与排查应以 `@ai-sdk/mcp` 的 transport/握手行为为准（如 HTTP transport、initialize/initialized、tools/list）。

### 3.4 MCP 运行时架构（`lib/infra/mcp/`）

MCP 运行时已从 `lib/mcp/` 迁移至 `lib/infra/mcp/`，核心设计保持不变——接口抽象 + 依赖注入，配置由调用方传入。

#### 3.4.1 模块结构

| 文件 | 职责 |
|------|------|
| `lib/infra/mcp/interface.ts` | 接口定义（McpServerConfig、McpRuntimeConfig 等） |
| `lib/infra/mcp/runtime.ts` | 运行时实现（McpRuntime 类、createMcpRuntime 工厂函数） |
| `lib/infra/mcp/index.ts` | 模块统一导出 |

#### 3.4.2 关键接口

| 接口/类型 | 文件 | 说明 |
|-----------|------|------|
| `McpServerConfig` | `lib/infra/mcp/interface.ts` | 单个 MCP 服务器连接参数（id、name、url、headers、enabled） |
| `McpToolConfig` | `lib/infra/mcp/interface.ts` | Agent 选中的工具配置（serverId、toolName） |
| `McpRuntimeConfig` | `lib/infra/mcp/interface.ts` | 运行时配置（servers + tools），由调用方传入 |
| `McpRuntimeDiagnostic` | `lib/infra/mcp/interface.ts` | 诊断信息（level、code、message、context） |
| `McpRuntimeResult` | `lib/infra/mcp/interface.ts` | 运行时构建结果（tools、cleanup、diagnostics） |
| `McpRuntimeInterface` | `lib/infra/mcp/interface.ts` | 运行时接口（getTools、getDiagnostics、cleanup） |
| `McpRuntimeFactory` | `lib/infra/mcp/interface.ts` | 工厂函数类型 |
| `McpServerGroupedConfig` | `lib/infra/mcp/interface.ts` | 服务器分组配置（运行时内部使用） |
| `McpToolMapping` | `lib/infra/mcp/interface.ts` | 工具映射结果（sourceToolName → injectedToolName） |

#### 3.4.3 `McpRuntime` 类

实现 `McpRuntimeInterface` 接口，封装工具集合、诊断信息和客户端连接的生命周期管理：

- **`getTools()`**：获取当前工具集合。
- **`getDiagnostics()`**：获取诊断信息。
- **`cleanup()`**：统一 `close()` 所有客户端连接，防止重复关闭（`cleanedUp` 标志位）。

#### 3.4.4 `createMcpRuntime` 工厂函数

核心策略——**尽力模式（best-effort）**，单服务失败不抛错，跳过并继续组装其他服务工具：

1. 按 `serverId` 分组（`groupToolsByServer`），同一服务只建连一次；
2. 使用 `createMCPClient`（HTTP transport）连接，headers 来自配置；
3. 只挂载配置中选中的工具（白名单）；
4. 单个服务连接失败或工具拉取失败时记录诊断信息并跳过；
5. **连接释放**：通过 `McpRuntime.cleanup()` 统一 `close()` 所有客户端。

#### 3.4.5 MCP 适配器（`lib/agents/mcp-runtime.ts`）

`lib/agents/mcp-runtime.ts` 现作为**适配器**，桥接外部配置与 MCP 运行时：

- **不直接查数据库**：配置通过 `params.servers` 和 `params.tools` 参数传入。
- **委托 `lib/infra/mcp`**：内部调用 `createMcpRuntime` 完成实际运行时创建。
- **`createAgentMcpRuntimeTools(params)`**：接受 `{ servers: McpServerConfig[], tools: McpToolConfig[] }`，返回 `{ tools, cleanup, diagnostics }`。

#### 3.4.6 Agent Chat 运行时调用链

Agent Chat 路由（`app/api/agent-chat/route.ts`）已将业务逻辑迁移到 `lib/agent-chat/` 模块：

```
app/api/agent-chat/route.ts
  → lib/agent-chat/runtime.ts (createRuntime)
    → lib/agents/mcp-runtime.ts (createAgentMcpRuntimeTools)  // 适配器
      → lib/infra/mcp/runtime.ts (createMcpRuntime)           // 核心运行时
```

`lib/agent-chat/runtime.ts` 负责从数据库读取 MCP 配置（`getAgentMcpRuntimeToolConfigs`），组装 `McpRuntimeConfig`，然后通过适配器创建运行时。

### 3.5 工具注册表架构（`lib/infra/tools/`）

新增 `lib/infra/tools/` 模块，提供统一的工具注册、创建和管理能力。

#### 3.5.1 模块结构

| 文件 | 职责 |
|------|------|
| `lib/infra/tools/registry.ts` | 工具注册表核心类（`ToolRegistry`）及全局实例操作 |
| `lib/infra/tools/types.ts` | 工具模块类型定义（ToolType、ToolCreator、ToolDefinition 等） |
| `lib/infra/tools/service.ts` | 工具服务接口（`ToolService`），提供统一的注册和创建能力 |
| `lib/infra/tools/init.ts` | 工具初始化模块，预注册内置工具定义（tavily、sandbox、mcp） |
| `lib/infra/tools/system.ts` | 系统工具定义（sandbox bash/readFile/writeFile）及元数据 |
| `lib/infra/tools/sandbox.ts` | Sandbox 工具创建封装 |
| `lib/infra/tools/index.ts` | 模块统一导出 |

#### 3.5.2 `ToolRegistry` 类

纯内存注册表，不依赖数据库，支持动态扩展工具：

- **`register(definition, strategy?)`**：注册工具，支持冲突处理策略（`warn`/`error`/`overwrite`）。
- **`registerAll(definitions, strategy?)`**：批量注册。
- **`get(name)`**：查找工具定义。
- **`create(name)`**：创建单个工具实例（调用 `ToolDefinition.create()`）。
- **`createAll(names)`**：批量创建工具实例，合并工具集合，统一清理函数。
- **全局实例**：`globalRegistry` 单例，通过 `registerTool`/`getTool`/`createTools` 等函数操作。

#### 3.5.3 系统工具定义

系统工具是平台内置能力，所有工具 ID 以 `system:` 开头：

| 工具 ID | 名称 | 说明 |
|---------|------|------|
| `system:sandbox:bash` | bash | 在沙盒环境中执行 bash 命令 |
| `system:sandbox:readFile` | readFile | 读取沙盒工作空间中的文件内容 |
| `system:sandbox:writeFile` | writeFile | 写入文件到沙盒工作空间 |

系统工具元数据定义在 `lib/infra/tools/system.ts` 的 `SYSTEM_TOOLS_META` 常量中，包含 `id`、`name`、`description`、`inputSchema`、`source`、`isAvailable` 字段。

#### 3.5.4 工具初始化

`lib/infra/tools/init.ts` 提供按需初始化能力：

- **`initTools(toolNames)`**：根据工具名称列表注册对应的工具定义（tavily/sandbox/mcp）。
- **`initAllTools()`**：初始化所有内置工具。
- 各工具注册函数（`registerTavilyTool`、`registerSandboxTool`、`registerMcpTool`）采用幂等设计，已注册时跳过。

#### 3.5.5 统一工具列表 API（`app/api/tools/route.ts`）

`GET /api/tools` 返回合并的工具列表：

- **系统工具**：直接使用 `SYSTEM_TOOLS_META` 常量，`isAvailable` 始终为 `true`。
- **MCP 工具**：从数据库查询（JOIN `mcp_tools` 和 `user_mcp_servers`），根据服务器在线状态判断可用性。
- **排序**：系统工具优先，MCP 工具按名称排序。
- **统计**：返回 `stats`（total、system、mcp、available）。

### 3.6 工具注入命名规则

**当前规则**（v1.2 起生效）：

注入名直接使用 **清洗后的原始工具名**，不再使用 `mcp__{serverIdShort}__{toolName}` 前缀格式。

- **清洗规则**：`sanitizeName(name)` 将非字母数字下划线字符替换为 `_`，空字符串回退为 `tool`。
- **防冲突兜底**：`buildInjectedToolName` 保留 `usedInjectedNames` 检查，运行时冲突时自动加后缀 `_2`、`_3`…（理论上不应发生，唯一性由 Agent 配置时保证）。

旧规则（v1.1 及之前）：`mcp__{serverIdShort}__{toolName}`，其中 `serverIdShort` 为 `user_mcp_servers.id` 清洗后取前 12 位。

### 3.7 与系统工具合并

- **`lib/agents/toolset-merge.ts`** 的 `mergeAgentToolSets` 将沙盒工具与 MCP 工具合并；若 key 冲突则 **保留系统工具**，跳过同名 MCP 条目。

### 3.8 失败策略与排障

- **best-effort**：单个 MCP 服务连接或拉取工具列表失败时仅跳过该服务；全部 MCP 不可用时仍可仅用系统工具对话。
- **连接释放**：每次对话流式结束（`onFinish` 的 `finally`）或流式启动失败时调用 MCP 侧 **`cleanup`**，避免连接泄漏。
- **排障日志**：服务端打印 JSON 摘要，前缀 **`Agent MCP运行时挂载摘要:`**，内含 `agentId`、`conversationId`、`mcpServerCount`、`mcpMappedToolCount`、`diagnosticsSummary`（按诊断码计数）、`diagnosticsDetails`（含 `serverId`/`serverName`/`toolName`/`message` 等）。

**Agent Chat 请求约定：** 浏览器侧通过 **`Authorization: Bearer <token>`** 传递 JWT 访问令牌进行身份验证（`lib/agent-chat/auth-context.ts` 封装了认证逻辑），body 中带 `agentId` 与 `conversationId`。

---

## 4. 前端实现

- **`app/settings/mcp`**：配置服务器、触发同步工具、查看状态。  
- 请求头需携带 **`Authorization: Bearer <token>`**（JWT 访问令牌），前端通过 `useAuth` hook 获取认证头。
- MCP 状态更新机制依赖前端轮询（`useMcpServersPolling`，默认 30 秒）：  
  - 页面可见时才持续轮询；  
  - 页面隐藏（切到其他标签页/窗口）时会暂停；  
  - 重新切回页面后，短时间内可能先显示数据库中的旧状态（例如 `offline`），待下一次检查完成后刷新为最新状态。

---

## 5. 使用指南

1. 登录后在设置页 **添加 MCP 服务 URL**（及必要 headers）。  
2. 使用界面提供的 **检测/同步工具** 拉取工具列表。

---

## 6. 注意事项

1. MCP 路由当前统一走 JWT 鉴权（`authenticateRequest` / `authenticateRequestOptional`），无有效令牌时返回 401，**不支持匿名访问**。
2. 工具可用性依赖服务器在线状态与缓存同步结果：状态检查接口会探活服务器并刷新 `mcp_tools`。  
3. `lib/db/mcp.ts` 中的 `migrateMcpData` 函数为历史遗留代码，当前无任何路由调用。系统已不支持匿名用户，无需数据迁移。
4. "切回页面看到 MCP 全离线"不一定代表服务端真实离线，常见是轮询暂停后的短暂旧状态显示；可手动点"检查状态"立即刷新。
5. Agent Chat 运行时是否能真正调用 MCP 以实时建连结果为准，数据库 `status/is_available` 仅作为缓存参考。
6. `lib/infra/mcp/` 模块采用配置外部传入的模式（`McpRuntimeConfig`），不直接依赖数据库查询，便于单元测试和替换。`lib/agents/mcp-runtime.ts` 作为适配器桥接外部配置。
7. `lib/infra/tools/` 提供统一的工具注册表机制（纯内存，不依赖数据库），支持动态扩展工具类型。

---

## 7. 相关文件清单

| 路径 | 说明 |
|------|------|
| **MCP 运行时（`lib/infra/mcp/`）** | |
| `lib/infra/mcp/interface.ts` | MCP 运行时接口定义（McpServerConfig、McpRuntimeConfig 等） |
| `lib/infra/mcp/runtime.ts` | MCP 运行时实现（McpRuntime 类、createMcpRuntime 工厂函数） |
| `lib/infra/mcp/index.ts` | MCP 模块统一导出 |
| **工具注册表（`lib/infra/tools/`）** | |
| `lib/infra/tools/registry.ts` | 工具注册表核心类（ToolRegistry）及全局实例操作 |
| `lib/infra/tools/types.ts` | 工具模块类型定义（ToolType、ToolCreator 等） |
| `lib/infra/tools/service.ts` | 工具服务接口（ToolService） |
| `lib/infra/tools/init.ts` | 工具初始化模块（tavily、sandbox、mcp 预注册） |
| `lib/infra/tools/system.ts` | 系统工具定义及元数据（bash/readFile/writeFile） |
| `lib/infra/tools/sandbox.ts` | Sandbox 工具创建封装 |
| `lib/infra/tools/index.ts` | 工具模块统一导出 |
| **Agent 运行时** | |
| `lib/agents/mcp-runtime.ts` | MCP 适配器，桥接外部配置与 MCP 运行时（不查数据库） |
| `lib/agents/toolset-merge.ts` | 沙盒工具与 MCP 工具合并（系统工具优先） |
| `lib/agent-chat/runtime.ts` | Agent Chat 运行时创建（读取 DB 配置，组装 McpRuntimeConfig） |
| **数据库与 Schema** | |
| `lib/schemas/tool.ts` | MCP 和 Skill 数据库表结构与类型定义（从 lib/db/schema.ts 拆分） |
| `lib/db/mcp.ts` | `migrateMcpData`（历史遗留，当前未被调用） |
| `lib/db/agents.ts` | `getAgentMcpRuntimeToolConfigs`（运行时配置联表） |
| **API 路由** | |
| `app/api/mcp/**` | MCP HTTP API（CRUD、工具列表、状态检查） |
| `app/api/mcp/[id]/status/route.ts` | 基于 `@ai-sdk/mcp` 的状态检查与工具同步 |
| `app/api/tools/route.ts` | 统一工具列表 API（系统工具 + MCP 工具合并） |
| `app/api/agent-chat/route.ts` | Agent 对话 API（组装者，业务逻辑委托 lib/agent-chat/） |
| `app/api/v1/chat/route.ts` | V1 对话 API（直接调用 `createMcpRuntime`） |
| **鉴权（`lib/infra/user/`）** | |
| `lib/infra/user/middleware.ts` | `authenticateRequest`、`authenticateRequestOptional`、`withAuth`、`getAuthContext` |
| `lib/infra/user/jwt.ts` | JWT 令牌生成与验证（`generateTokenPair`、`verifyAccessToken`、`extractAccessToken`） |
| `lib/infra/user/server.ts` | Server Component 认证工具（`auth`、`isAuthenticated`，从 cookie 读取 JWT） |
| `lib/infra/user/index.ts` | 认证模块统一导出 |
| `lib/agent-chat/auth-context.ts` | Agent Chat 认证上下文（包装 `authenticateRequestOptional`，返回 Result 类型） |
| `app/api/auth/login/route.ts` | 登录 API（颁发 JWT 令牌对 + 设置 cookie） |
| `app/api/auth/register/route.ts` | 注册 API（验证邀请码 + 创建用户 + 颁发 JWT） |
| **前端 Hooks** | |
| `lib/hooks/use-mcp-servers.ts` | MCP 服务器管理 Hooks（`useMcpServers`、`useMcpServersPolling`、`useMcpServer`） |
| **Schema 导出** | |
| `lib/schemas/index.ts` | Schema 统一导出入口（用户、对话、Agent、MCP、文档等表结构与类型） |

**创建时间：** 2026-03-28  
**最后修订：** 2026-04-30（修正鉴权描述：移除匿名用户相关内容，明确仅支持 JWT 鉴权；修正 lib/auth/middleware.ts 路径为 lib/infra/user/middleware.ts；标注 migrateMcpData 为未使用的历史遗留代码；补充 lib/infra/user/、lib/agent-chat/auth-context.ts、lib/schemas/index.ts、lib/hooks/use-mcp-servers.ts 等遗漏文件）  
**版本：** v1.4
