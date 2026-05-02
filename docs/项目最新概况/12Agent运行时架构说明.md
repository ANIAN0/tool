# Agent运行时架构说明

> 本文档记录Agent会话启动时，工具、MCP服务、模型的运行时解析、注册与组装机制，覆盖ToolRegistry、McpRuntime、ProviderRegistry/Resolver、WorkflowChat Agent四大模块的设计与实现，为开发者提供运行时层的技术参考。

---

## 系统概述

本项目引入了独立的「Agent运行时架构层」，负责Agent会话启动时的四大核心运行时能力：

- **工具注册表（ToolRegistry）**：纯内存注册表，支持动态注册、查找、冲突处理和批量创建工具实例
- **MCP运行时（McpRuntime）**：基于配置驱动的MCP服务构建，采用尽力模式（best-effort），单服务失败不阻断整次对话；Agent层通过适配器模式桥接外部配置
- **模型Provider注册表与Resolver**：管理模型提供商的注册/查找，及根据模型ID解析并创建LanguageModel实例；新增ModelService统一创建入口
- **WorkflowChat Agent**：独立的Agent定义、配置加载与工具创建模块，支持模板化运行时参数解析

这四者共同构成了Agent会话启动流程中的运行时组装管道：**模型解析 → 工具/MCP组装 → Agent实例化**。

---

## 技术栈

| 技术 | 用途 |
|------|------|
| Next.js | 后端 API 路由 |
| AI SDK | 工具定义（ToolSet）、模型类型（LanguageModel）、ToolLoopAgent |
| @ai-sdk/mcp | MCP客户端创建（createMCPClient） |
| @ai-sdk/openai-compatible | OpenAI兼容协议提供商 |
| @ai-sdk/devtools | 开发环境LLM调用调试中间件 |
| Turso (LibSQL) | Agent配置、MCP服务器配置持久化 |
| TypeScript | 类型系统与运行时类型约束 |

---

## 目录

- [系统架构](#系统架构)
- [核心模块表格](#核心模块表格)
- [后端实现](#后端实现)
  - [工具注册表（ToolRegistry）](#工具注册表toolregistry)
  - [MCP运行时（McpRuntime）](#mcp运行时mcpruntime)
  - [Agent MCP运行时适配器](#agent-mcp运行时适配器)
  - [模型Provider注册表与Resolver](#模型provider注册表与resolver)
  - [ModelService统一模型创建](#modelservice统一模型创建)
  - [运行时组装模块](#运行时组装模块)
  - [模型解析模块（model-resolver）](#模型解析模块model-resolver)
  - [工具集合并模块（toolset-merge）](#工具集合并模块toolset-merge)
  - [WorkflowChat Agent模块](#workflowchat-agent模块)
  - [WorkflowChat服务层](#workflowchat服务层)
  - [会话服务抽象层](#会话服务抽象层)
- [运行时组装流程](#运行时组装流程)
- [使用指南](#使用指南)
- [注意事项](#注意事项)
- [相关文件清单](#相关文件清单)

---

## 系统架构

### 整体架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Agent 会话启动流程                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  请求进入 (agent-chat API)                                           │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────┐                                                 │
│  │ 模型解析         │  ← ProviderRegistry + Resolver + ModelService  │
│  │ (model-resolver) │    查找用户模型配置 → 构建LanguageModel实例     │
│  └────────┬────────┘                                                │
│           │ chatModel, contextLimit                                   │
│           ▼                                                          │
│  ┌─────────────────┐                                                 │
│  │ 运行时创建       │  ← createRuntime()                             │
│  │ (runtime.ts)    │    加载Skills → 构建系统提示词                   │
│  └────────┬────────┘    创建沙盒工具 → 构建MCP工具 → 合并            │
│           │ tools, systemPrompt, mcpCleanup                           │
│           ▼                                                          │
│  ┌─────────────────┐                                                 │
│  │ Agent执行       │  ← executeAgent()                               │
│  │ (ToolLoopAgent) │    模板停止条件 → 流式对话 + 工具循环            │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                 │
│  │ MCP清理          │  ← buildSafeMcpCleanup()                      │
│  │ (请求结束后)     │    安全关闭MCP客户端连接                         │
│  └─────────────────┘                                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                     运行时模块依赖关系                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌──────────────────┐   ┌──────────────────┐ │
│  │ ToolRegistry    │    │ McpRuntime        │   │ ProviderRegistry │ │
│  │ (工具注册表)    │    │ (MCP运行时)       │   │ (提供商注册表)   │ │
│  │ lib/infra/tools │    │ lib/infra/mcp     │   │ lib/infra/model  │ │
│  │                 │    │                  │   │                  │ │
│  │ • register()   │    │ • createMcp-     │   │ • register()     │ │
│  │ • createAll()  │    │   Runtime()      │   │ • get()          │ │
│  │ • conflict-    │    │ • best-effort    │   │ • createModel()  │ │
│  │   Strategy     │    │ • diagnostics    │   │                  │ │
│  └─────────────────┘    └────────┬─────────┘   └────────┬─────────┘ │
│                                  │                       │           │
│                                  ▼                       ▼           │
│                    ┌──────────────────────┐   ┌─────────────────┐   │
│                    │ Agent MCP 适配器      │   │ ModelService    │   │
│                    │ lib/agents/mcp-      │   │ lib/infra/model │   │
│                    │   runtime.ts         │   │                 │   │
│                    │ • 参数传入配置       │   │ • createModel() │   │
│                    │ • 不依赖数据库       │   │ • wrapDevTools  │   │
│                    └──────────────────────┘   └─────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ WorkflowChat Agent（lib/workflowchat/）                       │   │
│  │                                                              │   │
│  │ • agent.ts       → ToolLoopAgent 工厂函数                    │   │
│  │ • agent-loader.ts → Agent 配置加载与运行时参数解析            │   │
│  │ • agent-tools.ts  → 工具集合创建（系统工具 + Skill 工具）     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                 WorkflowChat 服务层架构（新增）                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ API 层（app/api/workflowchat/）                                │  │
│  │                                                               │  │
│  │ • route.ts → POST /conversations、POST /messages 等入口       │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Service 层（lib/workflowchat/service.ts）                      │  │
│  │                                                               │  │
│  │ • sendMessage() → Agent配置加载 → 消息写入 → Run创建          │  │
│  │                  → reconcileActiveStream → Workflow启动       │  │
│  │                  → CAS claim → 回填workflow_run_id            │  │
│  │ • createConversation() → 会话创建                             │  │
│  │ • getActiveStreamRun() → 流式重连句柄获取                      │  │
│  │ • reconcileExistingActiveStream() → stale activeStreamId清理  │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Repository 层（lib/workflowchat/repository.ts）                │  │
│  │                                                               │  │
│  │ • CRUD: create/get/update/delete（会话、消息、Run、Step）      │  │
│  │ • CAS: claimChatActiveStreamId（幂等claim）                   │  │
│  │       compareAndSetActiveStreamId（严格CAS）                  │  │
│  │       clearActiveStreamId（兜底清除）                         │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Workflow 执行层（World + workflowchatReplyWorkflow）           │  │
│  │                                                               │  │
│  │ • start(workflowchatReplyWorkflow) → 主回复Workflow启动       │  │
│  │ • getRun(workflowRunId) → 重连已有Workflow Run               │  │
│  │ • Run.cancel() → 取消正在运行的Workflow                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                   会话服务抽象层架构（新增）                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ SessionService（统一接口）lib/infra/session/types.ts            ││
│  │                                                                 ││
│  │ • create(params) → 创建会话                                     ││
│  │ • get(id) → 获取会话详情                                        ││
│  │ • listByUser(userId) → 获取用户会话列表                         ││
│  │ • update(id, data) → 更新会话                                   ││
│  │ • delete(id) → 删除会话                                         ││
│  │ • touch(id) → 更新访问时间                                      ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────────┐ │
│  │ ChatSession     │ │ WorkflowSession │ │ BasicSessionService   │ │
│  │ Service         │ │ Service         │ │ (基础实现)            │ │
│  │                 │ │                 │ │                       │ │
│  │ • updateToken- │ │ • claimActive-  │ │ • 标准 CRUD           │ │
│  │   Totals()     │ │   StreamId()    │ │ • 无扩展功能          │ │
│  │ • updateComp-  │ │ • compareAnd-   │ │                       │ │
│  │   ressionCache │ │   SetActiveId() │ │                       │ │
│  │ • clearComp-   │ │ • clearActive-  │ │                       │ │
│  │   ressionCache │ │   StreamId()    │ │                       │ │
│  │                 │ │                 │ │                       │ │
│  │ (aisdk agent   │ │ (workflow agent │ │ (通用会话)            │ │
│  │  专有)         │ │  专有)          │ │                       │ │
│  └─────────────────┘ └─────────────────┘ └───────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                 sendMessage CAS claim 流程（新增）                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  sendMessage() 入口                                                  │
│       │                                                              │
│       ├─ 步骤1: 加载Agent配置 → loadAgentConfig()                    │
│       ├─ 步骤2: 校验agentId与会话绑定的agentId                        │
│       ├─ 步骤3: 写入user message → createWfChatMessage()             │
│       ├─ 步骤4: 创建run记录（status=pending）                        │
│       ├─ 步骤5: reconcileExistingActiveStream()                     │
│       │        ├─ active_stream_id为空 → 继续                       │
│       │        ├─ 对应run已终态 → CAS清除 → 继续                    │
│       │        └─ 对应run仍在运行 → 返回409冲突                      │
│       ├─ 步骤6: 启动Workflow → start(workflowchatReplyWorkflow)     │
│       ├─ 步骤7: CAS claim → claimChatActiveStreamId()               │
│       │        ├─ slot为空 → claim成功                             │
│       │        ├─ slot已被自己占用 → claim成功（幂等）              │
│       │        └─ slot被他人占用 → claim失败 → 取消Workflow → 409   │
│       ├─ 步骤8: 回填workflow_run_id → updateWfChatRun()             │
│       └─ 步骤9: 返回结果（runDTO + workflowRun句柄）                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 核心模块表格

| 模块 | 文件路径 | 职责 | 核心类/函数 |
|------|---------|------|------------|
| 工具注册表 | `lib/infra/tools/registry.ts` | 工具动态注册、查找、冲突处理、实例创建 | `ToolRegistry`类 |
| 工具类型定义 | `lib/infra/tools/types.ts` | 工具模块类型声明（ToolDefinition、ToolCreator等） | 类型导出 |
| 工具初始化 | `lib/infra/tools/init.ts` | 按需初始化工具定义注册 | `initTools()` |
| 工具服务 | `lib/infra/tools/service.ts` | 工具创建服务 | `createTools()` |
| MCP接口抽象 | `lib/infra/mcp/interface.ts` | MCP运行时的核心接口定义（配置、诊断、工厂） | `McpRuntimeInterface`等 |
| MCP运行时实现 | `lib/infra/mcp/runtime.ts` | MCP运行时核心实现（建连、工具拉取、尽力模式） | `McpRuntime`类、`createMcpRuntime()` |
| Agent MCP适配器 | `lib/agents/mcp-runtime.ts` | Agent维度的MCP运行时工具构建（适配器模式，参数传入配置） | `createAgentMcpRuntimeTools()` |
| Provider注册表 | `lib/infra/model/provider-registry.ts` | AI模型提供商注册与查找 | `ProviderRegistry`类（单例） |
| 模型Resolver | `lib/infra/model/resolver.ts` | 根据模型ID查找Provider并创建LanguageModel实例 | `resolveModel()`、`resolveUserModel()` |
| ModelService | `lib/infra/model/index.ts` | 统一模型创建入口（含DevTools包装） | `ModelService`类、`createModel()` |
| 用户Provider | `lib/infra/model/user-provider.ts` | 根据用户模型配置创建OpenAI-Compatible Provider | `createUserModelProvider()` |
| 模型中间件 | `lib/infra/model/middleware.ts` | LLM调用中间件（DevTools、压缩检测） | `wrapModelWithAllMiddlewares()` |
| Token估算 | `lib/infra/model/token-estimation.ts` | 固定系数Token估算 | `estimateTokens()` |
| 运行时组装 | `lib/agent-chat/runtime.ts` | 统一编排Agent会话运行时（模板停止条件、Skill加载、工具合并、MCP组装） | `createRuntime()`、`executeAgent()` |
| 模型解析 | `lib/agent-chat/model-resolver.ts` | 根据Agent绑定模型或用户默认模型构建聊天模型 | `resolveModel()`、`buildChatModelFromUserModel()` |
| Agent Chat类型 | `lib/agent-chat/types.ts` | Agent Chat API内部类型定义 | 类型导出 |
| 工具集合并 | `lib/agents/toolset-merge.ts` | 系统工具与MCP工具合并（系统优先） | `mergeAgentToolSets()` |
| WorkflowChat Agent | `lib/workflowchat/agent.ts` | WorkflowChat ToolLoopAgent工厂函数 | `createWorkflowChatAgent()` |
| Agent配置加载器 | `lib/workflowchat/agent-loader.ts` | 从数据库加载Agent配置并解析运行时参数 | `loadAgentConfig()`、`parseRuntimeConfig()` |
| Agent工具创建 | `lib/workflowchat/agent-tools.ts` | 根据Agent配置创建完整工具集合 | `createAgentTools()` |
| WorkflowChat模型解析 | `lib/workflowchat/model-resolver.ts` | 环境变量模型解析（支持前端modelId覆盖） | `resolveWorkflowChatModel()`、`resolveWorkflowChatModelId()` |
| WorkflowChat常量 | `lib/workflowchat/constants.ts` | 状态枚举、Workflow名称、StepTiming类型 | `WORKFLOWCHAT_RUN_STATUS`、`WORKFLOWCHAT_REPLY_WORKFLOW_NAME`、`StepTiming` |
| WorkflowChat DTO | `lib/workflowchat/dto.ts` | 请求/响应DTO、Workflow输入参数类型 | `ConversationDTO`、`MessageDTO`、`RunDTO`、`WorkflowChatRunInput` |
| WorkflowChat Repository | `lib/workflowchat/repository.ts` | 数据访问层（含CAS原子操作） | `createWfChatConversation()`、`claimChatActiveStreamId()`、`compareAndSetActiveStreamId()` |
| WorkflowChat Service | `lib/workflowchat/service.ts` | 业务服务层（sendMessage完整流程） | `sendMessage()`、`createConversation()`、`getActiveStreamRun()` |
| WorkflowChat调试工具 | `lib/workflowchat/debug/` | 调试工具（World、Hydrate、Service等） | `debugWorld()`、`hydrateMessages()` |
| 会话服务类型 | `lib/infra/session/types.ts` | 会话服务统一接口定义 | `SessionService`、`ChatSessionService`、`WorkflowSessionService` |
| 基础会话服务 | `lib/infra/session/service.ts` | 基础CRUD会话服务实现 | `createSessionService()`、`BasicSessionService` |
| Chat会话服务 | `lib/infra/session/chat-service.ts` | Chat会话扩展（token汇总、压缩缓存） | `createChatSessionService()`、`updateTokenTotals()` |
| Workflow会话服务 | `lib/infra/session/workflow-service.ts` | Workflow会话扩展（CAS原子操作） | `createWorkflowSessionService()`、`claimActiveStreamId()` |
| 会话服务导出 | `lib/infra/session/index.ts` | 会话服务模块统一导出 | `sessionServices` |

---

## 后端实现

### 工具注册表（ToolRegistry）

#### 类定义（`lib/infra/tools/registry.ts`）

```typescript
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private defaultStrategy: ConflictStrategy = 'warn';

  register(definition: ToolDefinition, strategy?: ConflictStrategy): RegisterResult;
  registerAll(definitions: ToolDefinition[], strategy?: ConflictStrategy): Map<string, RegisterResult>;
  get(name: string): ToolDefinition | undefined;
  has(name: string): boolean;
  getAll(): ToolDefinition[];
  getNames(): string[];
  unregister(name: string): boolean;
  clear(): void;
  get size(): number;
  setDefaultStrategy(strategy: ConflictStrategy): void;
  async create(name: string): Promise<ToolCreateResult | null>;
  async createAll(names: string[]): Promise<ToolCreateResult>;
}
```

#### 核心类型（`lib/infra/tools/registry.ts`）

| 类型 | 说明 |
|------|------|
| `ToolCreateResult` | 工具创建结果：`{ tools: ToolSet, cleanup?: () => Promise<void> }` |
| `ToolDefinition` | 工具定义：name、description、create函数、metadata |
| `ConflictStrategy` | 冲突策略：`'warn' \| 'error' \| 'overwrite'` |
| `RegisterResult` | 注册结果：success、existing、error |

#### 冲突处理策略

`registry.ts`中的`ConflictStrategy`支持三种策略：

| 策略 | 行为 |
|------|------|
| `warn` | 警告并跳过（默认），返回`{ success: false, existing }` |
| `error` | 拒绝注册，返回`{ success: false, error }` |
| `overwrite` | 覆盖已存在工具，返回`{ success: true, existing }` |

#### 全局注册表便捷函数

```typescript
const globalRegistry = new ToolRegistry();

export function registerTool(definition, strategy?): RegisterResult;
export function getTool(name: string): ToolDefinition | undefined;
export function getAllTools(): ToolDefinition[];
export function hasTool(name: string): boolean;
export function unregisterTool(name: string): boolean;
export async function createTools(names: string[]): Promise<ToolCreateResult>;
export function getGlobalRegistry(): ToolRegistry;
export function clearGlobalRegistry(): void;
```

#### 创建与清理机制

`createAll()`方法负责批量实例化工具并管理清理函数：

1. 遍历工具名称列表，调用每个工具的`create()`函数
2. 将所有返回的`ToolSet`通过`Object.assign`合并
3. 收集所有`cleanup`回调，合并为一个统一的清理函数
4. 清理函数内部逐一执行，捕获错误避免级联失败

---

### MCP运行时（McpRuntime）

#### 接口定义（`lib/infra/mcp/interface.ts`）

##### 服务器与工具配置

```typescript
interface McpServerConfig {
  id: string;                    // 服务唯一标识
  name: string;                  // 服务名称（人类可读）
  url: string;                   // 服务连接URL
  headers?: Record<string, string>; // 自定义请求头
  enabled: boolean;              // 启用状态
}

interface McpToolConfig {
  serverId: string;              // 所属服务器ID
  toolName: string;              // 工具名称（白名单）
}

interface McpRuntimeConfig {
  servers: McpServerConfig[];    // 所有MCP服务器配置
  tools: McpToolConfig[];        // Agent选中的工具配置
}
```

##### 诊断体系

```typescript
interface McpRuntimeDiagnostic {
  level: "info" | "warn" | "error";
  code: "SERVER_DISABLED"
      | "SERVER_CONNECT_FAILED"
      | "REMOTE_TOOLS_FETCH_FAILED"
      | "TOOL_NOT_FOUND_ON_SERVER"
      | "TOOL_MAPPED";
  message: string;
  context?: Record<string, unknown>;
}
```

| 代码 | 级别 | 含义 |
|------|------|------|
| `SERVER_DISABLED` | warn | 服务器被禁用，跳过 |
| `SERVER_CONNECT_FAILED` | error | 服务器连接失败，跳过该服务 |
| `REMOTE_TOOLS_FETCH_FAILED` | error | 工具列表拉取失败，跳过该服务 |
| `TOOL_NOT_FOUND_ON_SERVER` | warn | 白名单工具未在远端找到，跳过该工具 |
| `TOOL_MAPPED` | info | 工具成功映射并注入 |

##### 运行时结果与接口

```typescript
interface McpRuntimeResult {
  tools: ToolSet;                              // 最终可注入Agent的工具集合
  cleanup: () => Promise<void>;                // 释放MCP连接的清理函数
  diagnostics: McpRuntimeDiagnostic[];          // 运行时诊断信息
}

interface McpRuntimeInterface {
  getTools(): ToolSet;
  getDiagnostics(): McpRuntimeDiagnostic[];
  cleanup(): Promise<void>;
}

type McpRuntimeFactory = (config: McpRuntimeConfig) => Promise<McpRuntimeResult>;
```

##### 辅助类型

```typescript
interface McpServerGroupedConfig {
  server: McpServerConfig;
  selectedToolNames: Set<string>;
}

interface McpToolMapping {
  sourceToolName: string;       // 远端服务返回的工具名
  injectedToolName: string;     // 注入给Agent的工具名
  serverId: string;
}
```

#### 运行时实现（`lib/infra/mcp/runtime.ts`）

##### McpRuntime类

```typescript
export class McpRuntime implements McpRuntimeInterface {
  private tools: ToolSet;
  private diagnostics: McpRuntimeDiagnostic[];
  private clients: MCPClient[];
  private cleanedUp: boolean;

  getTools(): ToolSet;
  getDiagnostics(): McpRuntimeDiagnostic[];
  async cleanup(): Promise<void>;  // 防止重复清理，逐个关闭客户端
}
```

##### 工厂函数 `createMcpRuntime()`

执行流程：

1. **空配置检测**：servers或tools为空时直接返回空结果
2. **按服务器分组**：`groupToolsByServer()`避免同一服务器重复建连
3. **逐个服务器处理**：
   - 禁用 → 记录`SERVER_DISABLED`诊断，跳过
   - 无选中工具 → 跳过建连
   - 建连失败 → 记录`SERVER_CONNECT_FAILED`，跳过
   - 工具拉取失败 → 记录`REMOTE_TOOLS_FETCH_FAILED`，跳过
   - 白名单筛选 → 遍历`selectedToolNames`，未找到则记录`TOOL_NOT_FOUND_ON_SERVER`
   - 成功映射 → 记录`TOOL_MAPPED`
4. **工具名清洗**：`sanitizeName()`将非法字符转为下划线，`buildInjectedToolName()`防冲突
5. **返回结果**：包含tools、cleanup和diagnostics

##### 工具名策略

```
原始工具名 → sanitizeName() → 运行时冲突检测 → 最终注入名
```

- `sanitizeName()`：`[^a-zA-Z0-9_]` → `_`
- 冲突检测：使用`usedInjectedNames` Set，冲突时添加`_2`、`_3`后缀
- 唯一性主要由Agent配置时保证，运行时做兜底

---

### Agent MCP运行时适配器

#### `lib/agents/mcp-runtime.ts`

该模块是MCP运行时在Agent业务层的**适配器**，采用适配器模式桥接外部配置与底层MCP运行时：

```typescript
interface AgentMcpRuntimeToolsResult {
  tools: ToolSet;
  cleanup: () => Promise<void>;
  diagnostics: McpRuntimeDiagnostic[];
}

async function createAgentMcpRuntimeTools(params: {
  servers: McpServerConfig[];
  tools: McpToolConfig[];
}): Promise<AgentMcpRuntimeToolsResult>
```

与`lib/infra/mcp/runtime.ts`的差异：

| 维度 | `lib/infra/mcp/runtime.ts` | `lib/agents/mcp-runtime.ts` |
|------|---------------------------|----------------------------|
| 配置来源 | 由调用方传入`McpRuntimeConfig` | 由调用方传入servers和tools数组 |
| 定位 | 通用MCP运行时工厂 | Agent业务层适配器 |
| 数据库依赖 | 无 | 无（配置通过参数传入） |
| 清理实现 | 类方法封装`McpRuntime.cleanup()` | 委托给底层`createMcpRuntime`返回的cleanup |

两者共享相同的尽力模式策略、工具名清洗逻辑和诊断体系。运行时组装模块（`runtime.ts`）负责从数据库读取配置后传入适配器。

---

### 模型Provider注册表与Resolver

#### ProviderRegistry（`lib/infra/model/provider-registry.ts`）

```typescript
type ProviderType = 'openai' | 'anthropic' | 'google' | 'azure' | 'vercel' | 'custom';

interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseURL?: string;
  options?: Record<string, unknown>;
}

interface ProviderRegistration {
  id: string;
  type: ProviderType;
  config: ProviderConfig;
  createModel: (modelId: string) => LanguageModel;
}

class ProviderRegistry {
  private providers = new Map<string, ProviderRegistration>();

  register(id: string, registration: ProviderRegistration): void;
  get(id: string): ProviderRegistration | undefined;
  has(id: string): boolean;
  getAll(): ProviderRegistration[];
  getIds(): string[];
  unregister(id: string): void;
  clear(): void;
}

export const providerRegistry = new ProviderRegistry();  // 单例
export function registerProvider(id, type, config, createModel): void;
export function getProvider(id: string): ProviderRegistration | undefined;
export function hasProvider(id: string): boolean;
```

#### ModelResolver（`lib/infra/model/resolver.ts`）

```typescript
interface ModelConfig {
  id: string;            // 模型ID
  providerId: string;     // 提供商ID
  modelName: string;     // 提供商特定模型名
  contextLimit: number;  // 上下文上限（token数）
  isDefault?: boolean;   // 是否默认模型
}

interface ModelResolveResult {
  ok: boolean;
  model?: LanguageModel;    // 成功时
  modelName?: string;
  contextLimit?: number;
  error?: string;           // 失败时
}
```

##### 解析流程

```
resolveModel(modelId, userId?)
  │
  ├─ 查找模型配置（内存缓存） → ModelConfig
  │   └─ 未找到 → 尝试默认Provider → 返回默认模型
  │
  ├─ 获取Provider → ProviderRegistration
  │   └─ 未找到 → 返回错误
  │
  └─ 创建模型实例 → provider.createModel(config.modelName)
```

##### 用户模型解析

```
resolveUserModel(modelId, userId)
  │
  ├─ 从数据库获取用户模型 → getUserModelById()
  │   └─ 未找到 → 返回错误
  │
  ├─ 创建Provider → createUserModelProvider(userModel)
  │
  └─ 创建模型实例 → provider(userModel.model)
```

便捷函数：

| 函数 | 说明 |
|------|------|
| `registerModelConfig(modelId, config)` | 注册模型配置（内存缓存） |
| `getModelConfig(modelId)` | 获取模型配置 |
| `resolveModel(modelId, userId?)` | 解析模型实例 |
| `resolveUserModel(modelId, userId)` | 从数据库解析用户模型实例 |
| `getDefaultModel()` | 获取默认模型ID |
| `getAllModels()` | 获取所有已注册模型 |
| `clearModelRegistry()` | 清空注册表（测试用） |

---

### ModelService统一模型创建

#### `lib/infra/model/index.ts`

ModelService是统一的模型创建入口，整合了Provider创建、DevTools包装等能力：

```typescript
interface CreateModelParams {
  modelId: string;       // 模型ID
  userId: string;        // 用户ID
  wrapDevTools?: boolean; // 是否包装DevTools（默认开发环境自动启用）
}

interface CreateModelResult {
  model: LanguageModel;   // 语言模型实例
  modelName: string;      // 模型名称
  contextLimit: number;   // 上下文上限
  cleanup: () => void;    // 清理函数
}

class ModelService {
  registerProvider(id: string, registration: ProviderRegistration): void;
  async createModel(params: CreateModelParams): Promise<CreateModelResult>;
}

export const modelService = new ModelService();  // 单例
export async function createModel(params: CreateModelParams): Promise<CreateModelResult>;
export function registerProvider(id: string, registration: ProviderRegistration): void;
```

##### 创建流程

```
createModel({ modelId, userId, wrapDevTools })
  │
  ├─ 校验模型是否存在 → getUserModels(userId)
  │   └─ 未找到 → 抛出 ModelServiceError('MODEL_NOT_FOUND')
  │
  ├─ 创建Provider → createUserModelProvider(userModel)
  │
  ├─ 创建模型实例 → provider(userModel.model)
  │
  ├─ 包装DevTools（开发环境默认启用） → wrapModelWithDevTools()
  │
  └─ 返回 { model, modelName, contextLimit, cleanup }
```

#### 用户Provider（`lib/infra/model/user-provider.ts`）

负责根据用户模型配置创建OpenAI-Compatible Provider：

```typescript
function createUserProviderConfig(userModel: UserModel): UserProviderConfig;
function createUserModelProvider(userModel: UserModel): Provider;
function validateUserModel(userModel: UserModel): { valid: boolean; error?: string };
```

当前仅支持`provider=openai`（OpenAI-Compatible协议），通过`createOpenAICompatible`构建。

#### 模型中间件（`lib/infra/model/middleware.ts`）

提供LLM调用的中间件逻辑：

| 中间件 | 说明 |
|--------|------|
| `logInputMiddleware` | 开发环境日志中间件，打印消息数量和工具数量摘要 |
| `createCompressionDetectionMiddleware()` | 压缩检测中间件工厂，token超阈值时创建压缩任务 |
| `wrapModelWithAllMiddlewares()` | 包装模型并添加所有中间件（DevTools + 压缩检测） |
| `wrapModelWithDevTools()` | 仅添加DevTools中间件（开发环境） |

#### Token估算（`lib/infra/model/token-estimation.ts`）

固定系数估算规则：
- ASCII字符：约4字符 = 1 token
- 非ASCII字符（中文等）：约1.5字符 = 1 token

---

### 运行时组装模块

#### `lib/agent-chat/runtime.ts`

该模块是Agent会话启动的编排中心，统一协调Skill加载、沙盒工具创建、MCP工具构建和工具合并。

##### 核心函数 `createRuntime()`

```typescript
async function createRuntime(params: CreateRuntimeParams): Promise<RuntimeResult>
```

**执行流程：**

1. **获取Agent Skills**：`getAgentSkillsInfo(agent.id)`
2. **加载Skills到沙盒**（条件：沙盒启用且有Skills配置）
   - 成功 → 获取`skillPresetPrompt`，追加到系统提示词
   - 失败 → 记录警告，系统提示词不含Skill信息
3. **构建系统提示词**：`agent.system_prompt` + Skill预置提示词
4. **创建沙盒工具**：`getSandboxToolsWithContext({ conversationId, userId })`
5. **构建MCP运行时工具**：
   - 从数据库获取Agent绑定的MCP工具配置：`getAgentMcpRuntimeToolConfigs(agent.id, agent.user_id)`
   - 转换配置格式为MCP运行时所需格式
   - 调用适配器：`createAgentMcpRuntimeTools({ servers, tools })`
   - 成功 → 保存`mcpRuntimeCleanup`，合并工具
   - 失败 → 降级为仅系统工具，不阻断对话
6. **工具合并**：`mergeAgentToolSets({ systemTools, mcpTools })`（系统工具优先）
7. **返回结果**：`{ ok, tools, systemPrompt, mcpCleanup }`

##### 模板配置解析函数 `parseStopConditionFromTemplate()`

```typescript
function parseStopConditionFromTemplate(agent: AgentWithTools): StopCondition<ToolSet>
```

**执行流程：**

1. **获取模板定义**：`getTemplateById(agent.template_id)`
   - 模板不存在 → 使用默认步数20
2. **解析模板配置JSON**：`JSON.parse(agent.template_config)`
   - 解析失败 → 使用模板默认配置
   - 无配置 → 使用模板默认配置
3. **生成停止条件对象**：`template.createStopCondition(config)`
4. **转换为AI SDK StopCondition**：
   - `stepCount`类型 → `stepCountIs(maxSteps)`，步数限制在1-100范围内
   - 未知类型 → 使用默认步数20

##### 执行函数 `executeAgent()`

```typescript
async function executeAgent(
  wrappedModel: LanguageModel,
  systemPrompt: string,
  tools: ToolSet,
  history: UIMessage[],
  message: UIMessage,
  agent: AgentWithTools
): Promise<StreamTextResult<ToolSet, never>>
```

**执行流程：**

1. 合并历史消息和当前新消息
2. 转换消息格式为模型消息格式：`convertToModelMessages()`
3. 从模板配置解析停止条件：`parseStopConditionFromTemplate(agent)`
4. 创建`ToolLoopAgent`实例，使用模板配置的停止条件
5. 执行流式响应：`agentInstance.stream({ messages })`

##### 类型定义（`lib/agent-chat/types.ts`）

| 类型 | 说明 |
|------|------|
| `ChatRequestBody` | 聊天请求体：message、conversationId、agentId |
| `ParseResult` | 请求解析结果：成功返回data，失败返回错误响应 |
| `AuthContextResult` | 认证验证结果：成功返回userId，失败返回错误响应 |
| `AgentLoadResult` | Agent加载结果：成功返回agent配置，失败返回错误响应 |
| `ModelResolveResult` | 模型解析结果：成功时含chatModel、modelName、contextLimit |
| `CreateRuntimeParams` | `createRuntime()`参数：agent、userId、conversationId |
| `RuntimeSuccessResult` | 成功结果：tools、systemPrompt、mcpCleanup |
| `RuntimeErrorResult` | 失败结果：Response对象 |
| `RuntimeResult` | 联合类型 |
| `StreamResponseConfig` | 流式响应配置：含conversationId、contextLimit、modelName、mcpCleanup |

---

### 模型解析模块（model-resolver）

#### `lib/agent-chat/model-resolver.ts`

负责根据Agent配置解析并构建聊天模型实例。使用公共设施层ModelService统一创建模型。

##### 解析逻辑

```
resolveModel(agentOwnerId, agentModelId, userId)
  │
  ├─ agentModelId 存在？
  │   ├─ 是 → getUserModelById(agentOwnerId, agentModelId)
  │   │        └─ 未找到 → 返回错误响应
  │   └─ 否 → getDefaultUserModel(userId)
  │            └─ 未找到 → 返回错误响应"请先配置默认模型"
  │
  └─ buildChatModelFromUserModel(userModel)
      ├─ provider != openai → 返回错误"仅支持OpenAI-Compatible"
      ├─ 解密API Key → decryptApiKey()
      ├─ 构建baseURL（用户配置 || "https://api.openai.com/v1"）
      ├─ createOpenAICompatible({ name, baseURL, apiKey })
      └─ provider.chatModel(userModel.model) → 返回chatModel
```

`wrapModel`直接转发`wrapModelWithAllMiddlewares`调用，应用压缩检测中间件。

当前仅支持`provider=openai`（OpenAI-Compatible协议），通过`createOpenAICompatible`构建。

---

### 工具集合并模块（toolset-merge）

#### `lib/agents/toolset-merge.ts`

```typescript
function mergeAgentToolSets(params: {
  systemTools: ToolSet;
  mcpTools: ToolSet;
}): ToolSet
```

**合并规则：系统工具优先**

1. 先复制`systemTools`（沙盒工具等）
2. 遍历`mcpTools`，仅当工具名不在`systemTools`中时才注入
3. 保证系统工具名和行为不被MCP工具覆盖

---

### WorkflowChat Agent模块

#### Agent定义（`lib/workflowchat/agent.ts`）

WorkflowChat Agent的ToolLoopAgent工厂函数，支持外部传入模型、工具和运行时参数：

```typescript
/** 默认最大执行步数 */
const DEFAULT_MAX_STEP_COUNT = 50;

/** 系统提示词构建函数 */
function buildSystemPrompt(customInstructions?: string): string;

/** 创建 WorkflowChat ToolLoopAgent 实例 */
function createWorkflowChatAgent(options?: {
  model?: LanguageModel;
  maxSteps?: number;
  customInstructions?: string;
  tools?: ToolSet;
}): ToolLoopAgent;
```

**特性：**
- 默认最大执行步数为50步（区别于AgentChat的模板配置步数）
- 支持自定义指令覆盖默认系统提示词
- 支持外部传入工具集合
- 使用`stepCountIs(maxSteps)`作为停止条件

#### Agent配置加载器（`lib/workflowchat/agent-loader.ts`）

负责从数据库加载Agent配置并解析运行时参数：

```typescript
interface AgentRuntimeConfig {
  maxSteps: number;              // 最大执行步数
  customInstructions?: string;   // 自定义指令
}

interface ToolConfig {
  id: string;
  name: string;
  source: 'system' | 'mcp';
  serverName?: string;
}

interface SkillConfig {
  id: string;
  name: string;
  description: string;
  storagePath: string | null;
  fileHash: string | null;
}

interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  modelId: string | null;
  maxSteps: number;
  customInstructions?: string;
  tools: ToolConfig[];
  skills: SkillConfig[];
}

function parseRuntimeConfig(agent: Agent): AgentRuntimeConfig;
async function loadAgentConfig(userId: string, agentId: string): Promise<LoadAgentConfigResult>;
function getDefaultRuntimeConfig(): AgentRuntimeConfig;
```

**配置解析流程：**

```
loadAgentConfig(userId, agentId)
  │
  ├─ 获取Agent → getAgentById(agentId, userId)
  │   └─ 不存在或无权 → 返回404错误
  │
  ├─ 解析运行时配置 → parseRuntimeConfig(agent)
  │   └─ 从 template_config JSON 解析 maxSteps 和 customInstructions
  │
  ├─ 获取关联Skills → getAgentSkillsInfo(agentId)
  │
  ├─ 构建工具配置列表 → 从 agent.tools 映射
  │
  └─ 返回完整AgentConfig
```

#### Agent工具创建（`lib/workflowchat/agent-tools.ts`）

根据Agent配置创建完整的工具集合，包含系统工具和Skill工具：

```typescript
async function createAgentTools(
  agentConfig: AgentConfig,
  userId: string,
  conversationId: string,
): Promise<ToolSet>
```

**创建流程：**

1. **系统工具创建**：
   - 提取工具名称列表
   - 按需初始化工具定义：`initTools(toolNames)`
   - 创建工具实例：`createTools(toolNames)`
   - 失败时不阻塞流程，继续使用空工具集

2. **Skill工具创建**：
   - 调用`createAgentSkillTools(agentConfig.id, userId, conversationId)`
   - 失败时不阻塞流程，继续使用已创建的系统工具

---

### WorkflowChat服务层

#### 模型解析器（`lib/workflowchat/model-resolver.ts`）

WorkflowChat专用的模型解析模块，支持环境变量默认 + 前端modelId覆盖策略：

```typescript
/** 环境变量键名常量 */
const ENV_API_KEY = "WORKFLOWCHAT_API_KEY";
const ENV_BASE_URL = "WORKFLOWCHAT_BASE_URL";
const ENV_MODEL = "WORKFLOWCHAT_MODEL";

/** 仅解析模型名称，不创建模型实例 */
function resolveWorkflowChatModelId(modelId?: string): string;

/** 解析模型并构建聊天模型实例 */
function resolveWorkflowChatModel(modelId?: string): LanguageModelV3;
```

**解析流程：**

```
resolveWorkflowChatModel(modelId)
  │
  ├─ modelId 有值 → 使用 modelId 作为模型名
  ├─ modelId 为空 → 使用环境变量 WORKFLOWCHAT_MODEL
  │   └─ 未配置 → 抛出明确错误
  │
  ├─ 读取 API Key（WORKFLOWCHAT_API_KEY，必填）
  │   └─ 未配置 → 抛出明确错误
  │
  ├─ 读取 baseURL（WORKFLOWCHAT_BASE_URL，可选）
  │   └─ 未配置 → 使用默认值 "https://api.openai.com/v1"
  │
  └─ 创建 OpenAI-Compatible provider → 返回 chatModel 实例
```

#### 常量定义（`lib/workflowchat/constants.ts`）

定义WorkflowChat模块使用的常量和类型：

```typescript
/** Workflow 名称 */
WORKFLOWCHAT_REPLY_WORKFLOW_NAME = 'workflowchatReplyWorkflow';
WORKFLOWCHAT_POST_FINISH_WORKFLOW_NAME = 'workflowchatPostFinishWorkflow';

/** 会话状态枚举 */
WORKFLOWCHAT_CONVERSATION_STATUS = { ACTIVE: 'active', ARCHIVED: 'archived' };

/** Run 状态枚举 */
WORKFLOWCHAT_RUN_STATUS = { PENDING: 'pending', RUNNING: 'running', COMPLETED: 'completed', FAILED: 'failed' };

/** Step 状态枚举 */
WORKFLOWCHAT_STEP_STATUS = { PENDING: 'pending', RUNNING: 'running', COMPLETED: 'completed', FAILED: 'failed' };

/** Step 执行耗时记录类型 */
interface StepTiming {
  runId: string;
  stepNumber: number;
  stepName: string;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  finishReason: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}
```

#### DTO类型定义（`lib/workflowchat/dto.ts`）

请求/响应DTO和Workflow输入参数类型：

```typescript
// 响应 DTO
interface ConversationDTO {
  id: string;
  userId: string | null;
  agentId: string;
  title: string | null;
  status: WorkflowChatConversationStatus;
  activeStreamId: string | null;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
}

interface MessageDTO {
  id: string;
  conversationId: string;
  runId: string | null;
  role: 'user' | 'assistant' | 'system';
  parts: string;
  createdAt: number;
}

interface RunDTO {
  id: string;
  conversationId: string;
  workflowRunId: string | null;
  workflowName: string;
  modelId: string;
  status: WorkflowChatRunStatus;
  errorJson: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  totalDurationMs: number | null;
  createdAt: number;
  updatedAt: number;
}

// Workflow 输入参数
interface WorkflowChatRunInput {
  conversationId: string;
  runId: string;
  requestMessageId: string;
  agentId: string;
  userId: string | null;
  modelId: string;
  messages: UIMessage[];
  maxSteps?: number;
  instructions?: string;
  skills?: SkillConfig[];
}

interface PostFinishInput {
  conversationId: string;
  runId: string;
  workflowRunId: string;
  requestMessageId: string;
  responseMessage: UIMessage | null;
  finishReason: string;
  error: string | null;
  userId: string | null;
  modelId: string;
  stepTimings: StepTiming[];
}
```

#### Repository层（`lib/workflowchat/repository.ts`）

数据访问层，提供完整的CRUD操作和CAS原子操作：

```typescript
// Conversations CRUD
createWfChatConversation(params): Promise<WorkflowChatConversation>;
getWfChatConversation(id): Promise<WorkflowChatConversation | null>;
getWfChatConversationsByUserId(userId): Promise<WorkflowChatConversation[]>;
getAllWfChatConversations(): Promise<WorkflowChatConversation[]>;
updateWfChatConversation(id, data): Promise<WorkflowChatConversation | null>;
deleteWfChatConversation(id): Promise<boolean>;
touchWfChatConversation(id): Promise<void>;

// CAS 原子操作
claimChatActiveStreamId(chatId, workflowRunId): Promise<boolean>;
compareAndSetActiveStreamId(chatId, expected, next): Promise<boolean>;
clearActiveStreamId(chatId): Promise<void>;

// Messages CRUD
createWfChatMessage(params): Promise<WorkflowChatMessage>;
getWfChatMessagesByConversationId(conversationId): Promise<WorkflowChatMessage[]>;

// Runs CRUD
createWfChatRun(params): Promise<WorkflowChatRun>;
getWfChatRun(id): Promise<WorkflowChatRun | null>;
getWfChatRunByWorkflowRunId(workflowRunId): Promise<WorkflowChatRun | null>;
getWfChatRunsByConversationId(conversationId): Promise<WorkflowChatRun[]>;
updateWfChatRun(id, data): Promise<WorkflowChatRun | null>;

// Run Steps CRUD
createWfChatRunStep(params): Promise<WorkflowChatRunStep>;
getWfChatRunStepsByWorkflowRunId(workflowRunId): Promise<WorkflowChatRunStep[]>;
updateWfChatRunStep(id, data): Promise<WorkflowChatRunStep | null>;
```

**CAS操作详解：**

| 函数 | 说明 | 返回值 |
|------|------|--------|
| `claimChatActiveStreamId` | 幂等claim：slot为空或已被自己占用时成功 | `true`表示成功，`false`表示被他人占用 |
| `compareAndSetActiveStreamId` | 严格CAS：仅当等于expected时更新为next | `true`表示成功，`false`表示不匹配 |
| `clearActiveStreamId` | 直接清除（兜底场景） | 无返回值 |

CAS实现使用`UPDATE ... WHERE ... RETURNING`语句判断是否成功，避免竞态条件。

#### Service层（`lib/workflowchat/service.ts`）

业务服务层，封装完整的sendMessage流程：

```typescript
// sendMessage 完整流程
async function sendMessage(
  conversationId: string,
  agentId: string,
  userId: string | null,
  content: string,
  modelId?: string,
): Promise<{ runDTO: RunDTO; workflowRun: Run<unknown> }>;

// 会话管理
createConversation(agentId, userId?, title?): Promise<ConversationDTO>;
getConversationDetail(conversationId): Promise<ConversationDetailDTO | null>;
listConversationsByUserId(userId): Promise<ConversationDTO[]>;
listAllConversations(): Promise<ConversationDTO[]>;
updateConversationTitle(conversationId, title): Promise<ConversationDTO | null>;
archiveConversation(conversationId): Promise<ConversationDTO | null>;
deleteConversation(conversationId): Promise<boolean>;

// Run 查询
getRunById(runId): Promise<RunDTO | null>;
getRunByWorkflowRunId(workflowRunId): Promise<RunDTO | null>;
listRunsByConversationId(conversationId): Promise<RunDTO[]>;

// 流式响应辅助
getActiveStreamRun(conversationId): Promise<Run<unknown> | null>;
reconnectWorkflowRun(workflowRunId): Promise<Run<unknown>>;
reconcileExistingActiveStream(conversationId): Promise<RunDTO | null>;
```

**sendMessage流程详解：**

```
sendMessage(conversationId, agentId, userId, content, modelId?)
  │
  ├─ 步骤0: 验证用户身份（必须登录）
  ├─ 步骤1: 加载Agent配置 → loadAgentConfig(userId, agentId)
  ├─ 步骤2: 校验agentId与会话绑定的agentId是否一致
  ├─ 步骤3: 写入user message → createWfChatMessage()
  ├─ 步骤4: 创建run记录（status=pending, workflow_run_id=null）
  ├─ 步骤5: reconcileExistingActiveStream()
  │        ├─ active_stream_id为空 → 继续
  │        ├─ 对应run已终态 → CAS清除 → 继续
  │        └─ 对应run仍在运行 → 标记run为failed → 返回409
  ├─ 步骤6: 构建workflow输入参数
  ├─ 步骤7: 启动workflow → start(workflowchatReplyWorkflow)
  ├─ 步骤8: CAS claim → claimChatActiveStreamId()
  │        ├─ 成功 → 继续
  │        └─ 失败 → 取消workflow → 标记run为failed → 返回409
  ├─ 步骤9: 回填workflow_run_id → updateWfChatRun()
  └─ 步骤10: 返回结果（runDTO + workflowRun句柄）
```

**自定义错误类型：**

| 错误类 | 说明 |
|--------|------|
| `SendMessageAgentConfigError` | Agent配置加载失败 |
| `SendMessageAgentMismatchError` | agentId与会话绑定的agentId不一致 |
| `SendMessageConflictError` | CAS claim失败或已有活跃run |
| `SendMessageConfigError` | 环境变量缺失 |

---

### 会话服务抽象层

#### 类型定义（`lib/infra/session/types.ts`）

提供统一抽象接口，分离数据层和业务层：

```typescript
// ==================== 基础接口 ====================

/** 会话基础接口 - 定义标准CRUD操作 */
interface SessionService {
  create(params: CreateSessionParams): Promise<Session>;
  get(id: string): Promise<Session | null>;
  listByUser(userId: string): Promise<Session[]>;
  update(id: string, data: UpdateSessionParams): Promise<Session | null>;
  delete(id: string): Promise<boolean>;
  touch(id: string): Promise<void>;
}

/** Chat会话服务扩展接口（aisdk agent专有） */
interface ChatSessionService extends SessionService {
  updateTokenTotals(id: string, usage: TokenUsage): Promise<void>;
  updateCompressionCache(id: string, cache: CompressionCache): Promise<void>;
  clearCompressionCache(id: string): Promise<void>;
  listByUserWithFilter(userId: string, options?: { source?: string }): Promise<Session[]>;
}

/** Workflow会话服务扩展接口（workflow agent专有） */
interface WorkflowSessionService extends SessionService {
  claimActiveStreamId(id: string, workflowRunId: string): Promise<boolean>;
  compareAndSetActiveStreamId(id: string, expected: string | null, next: string | null): Promise<boolean>;
  clearActiveStreamId(id: string): Promise<void>;
}

// ==================== 类型定义 ====================

interface Session {
  id: string;
  userId: string;
  title: string | null;
  model: string | null;
  agentId: string;
  isPrivate: boolean;
  source: string;
  createdAt: number;
  updatedAt: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  compressionCache: string | null;
}

interface WorkflowSession extends Session {
  activeStreamId: string | null;
  lastMessageAt: number;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface CompressionCache {
  messages: Array<{...}>;
  messageCount: number;
  removedCount: number;
  compressedAt: number;
}
```

#### 服务实现

| 服务 | 文件 | 说明 |
|------|------|------|
| `createSessionService()` | `lib/infra/session/service.ts` | 基础CRUD会话服务 |
| `createChatSessionService()` | `lib/infra/session/chat-service.ts` | Chat会话扩展（token汇总、压缩缓存） |
| `createWorkflowSessionService()` | `lib/infra/session/workflow-service.ts` | Workflow会话扩展（CAS原子操作） |

#### 统一导出（`lib/infra/session/index.ts`）

```typescript
export const sessionServices = {
  createSessionService,
  createChatSessionService,
  createWorkflowSessionService,
};
```

---

## 运行时组装流程

### 完整Agent会话启动时序

```
1. 请求进入 agent-chat API
   │
2. 模型解析（model-resolver.ts）
   ├─ Agent绑定了模型 → 使用创建者的模型池
   └─ Agent未绑定模型 → 使用当前用户的默认模型
   │
3. 运行时创建（runtime.ts :: createRuntime）
   ├─ 加载Skill到沙盒（如启用）
   ├─ 构建系统提示词（Agent prompt + Skill preset）
   ├─ 创建沙盒工具（绑定会话上下文）
   ├─ 构建MCP运行时工具（best-effort，失败降级）
   │   ├─ getAgentMcpRuntimeToolConfigs() → 从数据库读配置
   │   ├─ 转换配置格式 → servers + tools 数组
   │   ├─ createAgentMcpRuntimeTools() → 适配器模式调用底层MCP运行时
   │   │   ├─ 按服务器分组 → 避免重复建连
   │   │   ├─ 逐个建连 → 拉取工具 → 白名单筛选
   │   │   └─ 收集诊断 + 返回工具集 + cleanup函数
   │   └─ 合并工具（系统优先）
   └─ 返回 { tools, systemPrompt, mcpCleanup }
   │
4. Agent执行（runtime.ts :: executeAgent）
   ├─ 转换消息格式
   ├─ 从模板配置解析停止条件 → parseStopConditionFromTemplate(agent)
   ├─ 创建ToolLoopAgent实例（使用模板停止条件）
   └─ 流式执行
   │
5. 请求结束 → MCP清理（buildSafeMcpCleanup）
   └─ 安全关闭MCP客户端连接（失败仅告警）
```

### WorkflowChat Agent会话启动时序

```
1. 请求进入 WorkflowChat API
   │
2. Agent配置加载（agent-loader.ts :: loadAgentConfig）
   ├─ 获取Agent → getAgentById()
   ├─ 解析运行时配置 → parseRuntimeConfig()（maxSteps、customInstructions）
   ├─ 获取关联Skills
   └─ 返回完整AgentConfig
   │
3. 工具集合创建（agent-tools.ts :: createAgentTools）
   ├─ 系统工具创建 → initTools() + createTools()
   ├─ Skill工具创建 → createAgentSkillTools()
   └─ 合并返回ToolSet
   │
4. 模型解析
   ├─ 从AgentConfig获取modelId
   └─ 构建聊天模型实例
   │
5. Agent实例化（agent.ts :: createWorkflowChatAgent）
   ├─ 构建系统提示词（customInstructions || 默认提示词）
   ├─ 创建ToolLoopAgent（maxSteps步数控制）
   └─ 流式执行
```

### 降级策略总结

| 模块 | 降级场景 | 降级行为 |
|------|---------|---------|
| MCP运行时 | 服务器禁用 | 记录`SERVER_DISABLED`诊断，跳过该服务 |
| MCP运行时 | 连接失败 | 记录`SERVER_CONNECT_FAILED`，跳过该服务 |
| MCP运行时 | 工具拉取失败 | 记录`REMOTE_TOOLS_FETCH_FAILED`，跳过该服务 |
| MCP运行时 | 工具不在远端 | 记录`TOOL_NOT_FOUND_ON_SERVER`，跳过该工具 |
| MCP运行时 | 整体构建失败 | 降级为仅系统工具，不阻断对话 |
| Skill加载 | 加载失败 | 记录警告，系统提示词不含Skill信息 |
| 模型解析 | Agent绑定模型不存在 | 返回400错误 |
| 模型解析 | 用户未配置默认模型 | 返回400错误 |
| MCP清理 | 客户端关闭失败 | 记录告警，不影响主响应 |
| 模板停止条件 | 模板不存在 | 使用默认步数20 |
| 模板停止条件 | 配置JSON解析失败 | 使用模板默认配置 |
| WorkflowChat工具 | 系统工具创建失败 | 不阻塞流程，继续使用空工具集 |
| WorkflowChat工具 | Skill工具创建失败 | 不阻塞流程，继续使用已创建的系统工具 |

---

## 使用指南

### 注册自定义工具到ToolRegistry

```typescript
import { registerTool } from '@/lib/infra/tools';

registerTool({
  name: 'my-custom-tool',
  description: '自定义工具描述',
  create: async () => ({
    tools: { myTool: toolDefinition },
    cleanup: async () => { /* 释放资源 */ },
  }),
});
```

### 使用MCP运行时工厂创建MCP工具

```typescript
import { createMcpRuntime, type McpRuntimeConfig } from '@/lib/infra/mcp';

const config: McpRuntimeConfig = {
  servers: [{ id: 's1', name: '数据服务', url: 'https://...', enabled: true }],
  tools: [{ serverId: 's1', toolName: 'query_data' }],
};

const result = await createMcpRuntime(config);
// result.tools → 注入Agent的工具集合
// result.cleanup → 释放MCP连接的清理函数
// result.diagnostics → 运行时诊断信息
```

### 使用Agent MCP适配器

```typescript
import { createAgentMcpRuntimeTools } from '@/lib/agents/mcp-runtime';
import type { McpServerConfig, McpToolConfig } from '@/lib/infra/mcp';

const servers: McpServerConfig[] = [
  { id: 's1', name: '数据服务', url: 'https://...', enabled: true }
];
const tools: McpToolConfig[] = [
  { serverId: 's1', toolName: 'query_data' }
];

const result = await createAgentMcpRuntimeTools({ servers, tools });
// result.tools → 注入Agent的工具集合
// result.cleanup → 释放MCP连接的清理函数
// result.diagnostics → 运行时诊断信息
```

### 使用ModelService创建模型

```typescript
import { createModel } from '@/lib/infra/model';

const result = await createModel({
  modelId: 'user-model-id',
  userId: 'user-id',
  wrapDevTools: true,  // 可选，默认开发环境自动启用
});
// result.model → LanguageModel实例
// result.modelName → 模型名称
// result.contextLimit → 上下文上限
```

### 使用模型Resolver解析模型

```typescript
import { resolveModel, resolveUserModel, registerModelConfig } from '@/lib/infra/model/resolver';

// 注册模型配置（内存缓存）
registerModelConfig('gpt-4', {
  id: 'gpt-4',
  providerId: 'openai',
  modelName: 'gpt-4',
  contextLimit: 128000,
});

// 解析模型（内存缓存方式）
const result = await resolveModel('gpt-4');
if (result.ok) {
  const model = result.model;  // LanguageModel实例
}

// 解析用户模型（数据库方式）
const userResult = await resolveUserModel('model-id', 'user-id');
```

### 创建WorkflowChat Agent

```typescript
import { createWorkflowChatAgent } from '@/lib/workflowchat/agent';
import { loadAgentConfig } from '@/lib/workflowchat/agent-loader';
import { createAgentTools } from '@/lib/workflowchat/agent-tools';

// 1. 加载Agent配置
const configResult = await loadAgentConfig(userId, agentId);
if (!configResult.ok) throw new Error(configResult.error);

// 2. 创建工具集合
const tools = await createAgentTools(configResult.agent, userId, conversationId);

// 3. 创建Agent实例
const agent = createWorkflowChatAgent({
  model: chatModel,
  maxSteps: configResult.agent.maxSteps,
  customInstructions: configResult.agent.customInstructions,
  tools,
});
```

### 在Agent会话中使用运行时组装

运行时组装已在`lib/agent-chat/runtime.ts`中完整编排，开发者无需手动调用。如需自定义，可参照`createRuntime()`函数的流程。

---

## 注意事项

1. **尽力模式（Best-Effort）**：
   - MCP运行时采用尽力模式，单个服务/工具失败不阻断整次对话
   - 诊断信息通过`diagnostics`数组收集，用于日志排查
   - 清理函数失败仅记录告警，不影响主流程

2. **工具名冲突处理**：
   - 系统工具优先于MCP工具（`mergeAgentToolSets`规则）
   - MCP工具名通过`sanitizeName()`清洗非法字符
   - 运行时使用`usedInjectedNames` Set检测冲突，冲突时添加后缀

3. **MCP连接生命周期**：
   - 每次请求创建MCP客户端，请求结束通过`buildSafeMcpCleanup()`安全关闭
   - 清理函数防止重复执行（`cleanedUp`标志）
   - 客户端关闭使用`Promise.allSettled`，单个失败不影响其他关闭

4. **模型解析当前限制**：
   - `lib/infra/model/resolver.ts`中的`ProviderRegistry`是通用注册表
   - `lib/agent-chat/model-resolver.ts`仅支持`provider=openai`（OpenAI-Compatible协议）
   - `lib/infra/model/user-provider.ts`统一处理用户模型Provider创建
   - API Key存储为密文，运行时通过`decryptApiKey()`解密

5. **适配器模式**：
   - `lib/agents/mcp-runtime.ts`采用适配器模式，不直接依赖数据库
   - 配置由上层运行时组装模块从数据库读取后传入
   - 底层MCP运行时（`lib/infra/mcp/runtime.ts`）同样不依赖数据库

6. **全局注册表**：
   - `lib/infra/tools/registry.ts`中的`globalRegistry`是模块级单例
   - `lib/infra/model/provider-registry.ts`中的`providerRegistry`也是模块级单例
   - `clearGlobalRegistry()`和`providerRegistry.clear()`仅应在测试中使用

7. **模板停止条件**：
   - `parseStopConditionFromTemplate()`从Agent的`template_config`解析停止条件
   - 模板不存在时使用默认步数20
   - 配置JSON解析失败时使用模板默认配置
   - 步数限制在1-100范围内

8. **WorkflowChat Agent与AgentChat的区别**：
   - WorkflowChat Agent使用独立的工厂函数（`createWorkflowChatAgent`），默认最大步数50
   - AgentChat使用模板配置解析停止条件，步数由模板定义
   - WorkflowChat的工具创建通过`createAgentTools()`独立完成，包含系统工具和Skill工具
   - AgentChat的工具创建在`createRuntime()`中统一编排，包含沙盒工具和MCP工具

9. **模型中间件**：
   - 压缩检测中间件通过闭包方式传入conversationId和contextLimit
   - DevTools中间件仅在开发环境启用
   - Token估算使用固定系数（ASCII 4:1，非ASCII 1.5:1）

10. **WorkflowChat服务层（新增）**：
    - sendMessage流程包含完整的CAS claim机制，防止并发冲突
    - reconcileExistingActiveStream自动清理stale的active_stream_id
    - Repository层使用`UPDATE ... WHERE ... RETURNING`实现CAS原子操作
    - Service层自定义错误类型提供清晰的错误分类

11. **会话服务抽象层（新增）**：
    - SessionService提供统一CRUD接口，分离数据层和业务层
    - ChatSessionService扩展token汇总和压缩缓存功能（aisdk agent专有）
    - WorkflowSessionService扩展CAS原子操作管理活跃流（workflow agent专有）
    - 使用接口继承模式，方便不同业务场景定制扩展功能

---

## 相关文件清单

| 文件路径 | 功能说明 |
|---------|---------|
| `lib/infra/tools/registry.ts` | 工具注册表类（ToolRegistry）、全局注册表实例、冲突处理策略、批量创建 |
| `lib/infra/tools/types.ts` | 工具模块类型定义 |
| `lib/infra/tools/service.ts` | 工具创建服务 |
| `lib/infra/tools/init.ts` | 按需初始化工具定义注册 |
| `lib/infra/tools/system.ts` | 系统工具定义 |
| `lib/infra/tools/sandbox.ts` | 沙盒工具定义 |
| `lib/infra/tools/index.ts` | 工具模块统一导出 |
| `lib/infra/mcp/interface.ts` | MCP运行时接口抽象（McpServerConfig、McpToolConfig、McpRuntimeConfig、McpRuntimeDiagnostic、McpRuntimeInterface、McpRuntimeFactory等） |
| `lib/infra/mcp/runtime.ts` | MCP运行时核心实现（McpRuntime类、createMcpRuntime工厂函数、groupToolsByServer、sanitizeName、buildInjectedToolName） |
| `lib/infra/mcp/index.ts` | MCP模块统一导出（接口类型和运行时实现） |
| `lib/agents/mcp-runtime.ts` | Agent维度MCP运行时适配器（createAgentMcpRuntimeTools、适配器模式、参数传入配置） |
| `lib/agents/toolset-merge.ts` | 工具集合并（系统工具优先规则） |
| `lib/infra/model/provider-registry.ts` | AI Provider注册表（ProviderRegistry单例、registerProvider便捷函数） |
| `lib/infra/model/resolver.ts` | 模型解析器（resolveModel、resolveUserModel、registerModelConfig、ModelConfig、ModelResolveResult） |
| `lib/infra/model/user-provider.ts` | 用户模型Provider（createUserModelProvider、OpenAI-Compatible协议） |
| `lib/infra/model/middleware.ts` | 模型中间件（DevTools、压缩检测、wrapModelWithAllMiddlewares） |
| `lib/infra/model/token-estimation.ts` | Token估算模块（固定系数估算） |
| `lib/infra/model/index.ts` | ModelService统一模型创建入口（ModelService单例、createModel便捷函数） |
| `lib/agent-chat/runtime.ts` | 运行时组装编排（createRuntime、parseStopConditionFromTemplate、executeAgent） |
| `lib/agent-chat/model-resolver.ts` | 模型解析（resolveModel、buildChatModelFromUserModel、wrapModel） |
| `lib/agent-chat/types.ts` | Agent Chat API类型定义（CreateRuntimeParams、RuntimeResult、ModelResolveResult、StreamResponseConfig等） |
| `lib/workflowchat/agent.ts` | WorkflowChat Agent定义（createWorkflowChatAgent工厂函数、buildSystemPrompt） |
| `lib/workflowchat/agent-loader.ts` | Agent配置加载器（loadAgentConfig、parseRuntimeConfig、AgentConfig等类型） |
| `lib/workflowchat/agent-tools.ts` | Agent工具创建（createAgentTools、系统工具 + Skill工具） |
| `lib/workflowchat/model-resolver.ts` | WorkflowChat模型解析器（环境变量默认 + 前端modelId覆盖策略） |
| `lib/workflowchat/constants.ts` | WorkflowChat常量定义（状态枚举、Workflow名称、StepTiming类型） |
| `lib/workflowchat/dto.ts` | WorkflowChat DTO类型（请求/响应DTO、Workflow输入参数类型） |
| `lib/workflowchat/repository.ts` | WorkflowChat数据访问层（CRUD操作、CAS原子操作） |
| `lib/workflowchat/service.ts` | WorkflowChat业务服务层（sendMessage完整流程、会话管理、Run查询） |
| `lib/workflowchat/debug/index.ts` | WorkflowChat调试工具入口 |
| `lib/workflowchat/debug/dto.ts` | 调试DTO类型定义 |
| `lib/workflowchat/debug/hydrate.ts` | 消息hydrate工具 |
| `lib/workflowchat/debug/world.ts` | World调试工具 |
| `lib/workflowchat/debug/service.ts` | 调试服务层 |
| `lib/infra/session/types.ts` | 会话服务类型定义（SessionService统一接口、ChatSessionService扩展、WorkflowSessionService扩展） |
| `lib/infra/session/service.ts` | 基础会话服务实现（createSessionService、BasicSessionService） |
| `lib/infra/session/chat-service.ts` | Chat会话服务实现（token汇总、压缩缓存） |
| `lib/infra/session/workflow-service.ts` | Workflow会话服务实现（CAS原子操作管理活跃流） |
| `lib/infra/session/index.ts` | 会话服务模块统一导出（sessionServices） |

---

**创建时间**：2026-04-22
**最后更新**：2026-05-01
**版本**：v2.1
