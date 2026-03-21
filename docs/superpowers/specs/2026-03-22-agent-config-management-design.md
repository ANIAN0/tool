# Agent配置管理设计文档

> Phase 1: Agent配置页面设计与实现

## 1. 概述

### 1.1 背景

项目需要新增Agent配置管理功能，让用户可以创建、编辑和管理自己的Agent，同时支持公开分享Agent给其他用户使用。

### 1.2 目标

- 用户可以创建自定义Agent，配置名称、描述、模板、提示词、模型和工具
- 用户可以将自己的Agent设为公开，供其他用户查看
- 匿名用户可浏览公开Agent，但不可创建Agent
- 为后续AgentChat页面和沙盒工具集成奠定基础

### 1.3 范围

**Phase 1 包含：**
- Agent配置页面 (`/settings/agents`)
- Agent CRUD API
- 公开/私有切换功能
- 基础循环模板实现

**不在 Phase 1 范围：**
- AgentChat页面（Phase 2）
- 云端沙盒工具集成（Phase 3）
- 复杂的Agent模板（后续版本）

---

## 2. 功能需求

### 2.1 Agent配置页面

| 用户类型 | 权限 |
|----------|------|
| 登录用户 | 查看、创建、编辑、删除自己的Agent；查看公开Agent；切换公开/私有状态 |
| 匿名用户 | 仅查看公开Agent；不可创建、编辑、删除Agent |

### 2.2 Agent属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | Agent名称 |
| description | string | 否 | Agent描述 |
| templateId | string | 是 | 关联的模板ID |
| templateConfig | JSON | 否 | 模板配置参数 |
| systemPrompt | string | 否 | 系统提示词 |
| modelId | string | 否 | 关联的用户模型ID |
| toolIds | string[] | 否 | 关联的工具ID列表 |
| isPublic | boolean | 否 | 是否公开，默认私有 |

### 2.3 公开机制

- Agent默认为私有状态
- 创建者可手动切换公开/私有
- 公开的Agent对所有用户可见（包括匿名用户）
- 其他用户查看公开Agent时为只读模式，不可编辑、不可复制

### 2.4 匿名用户数据处理

由于Agent配置相对复杂，本期 **不支持匿名用户创建Agent**。

匿名用户登录后：
- 无需迁移Agent数据（匿名用户无法创建Agent）
- 可直接浏览公开Agent列表
- 登录后可开始创建自己的Agent

---

## 3. 数据库设计

### 3.1 agents 表

```sql
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_id TEXT NOT NULL,
  template_config TEXT,
  system_prompt TEXT,
  model_id TEXT,
  is_public INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | Agent唯一标识，使用nanoid生成 |
| user_id | TEXT | 创建者用户ID |
| name | TEXT | Agent名称 |
| description | TEXT | Agent描述 |
| template_id | TEXT | 模板ID，如 `basic-loop` |
| template_config | TEXT | 模板配置JSON，如 `{"stepCount": 20}` |
| system_prompt | TEXT | 系统提示词 |
| model_id | TEXT | 关联的用户模型ID（来自user_models表） |
| is_public | INTEGER | 是否公开（0:私有, 1:公开） |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

### 3.2 agent_tools 表

```sql
CREATE TABLE IF NOT EXISTS agent_tools (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id) REFERENCES mcp_tools(id) ON DELETE CASCADE,
  UNIQUE(agent_id, tool_id)
);
```

**说明：**
- 实现Agent与MCP工具的多对多关联，支持精确选择工具
- `UNIQUE(agent_id, tool_id)` 约束防止重复关联

### 3.3 索引

```sql
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_public ON agents(is_public);
CREATE INDEX IF NOT EXISTS idx_agent_tools_agent_id ON agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tools_tool_id ON agent_tools(tool_id);
```

---

## 4. API设计

### 4.1 接口列表

| 接口 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/agents` | GET | 获取Agent列表 | 所有用户 |
| `/api/agents` | POST | 创建Agent | 仅登录用户 |
| `/api/agents/[id]` | GET | 获取Agent详情 | 所有用户 |
| `/api/agents/[id]` | PUT | 更新Agent | 仅创建者 |
| `/api/agents/[id]` | DELETE | 删除Agent | 仅创建者 |
| `/api/agents/[id]/publish` | PATCH | 切换公开/私有 | 仅创建者 |

### 4.2 GET /api/agents

获取Agent列表，返回当前用户的Agent和所有公开Agent。

**请求头：**
```
Authorization: Bearer <token>           // 登录用户
X-Anonymous-Id: <anonymous_id>          // 匿名用户使用
```

**响应逻辑：**
- `myAgents`：仅登录用户返回自己创建的所有Agent（包括私有和公开）；匿名用户返回空数组
- `publicAgents`：返回所有其他用户公开的Agent（不包含自己的公开Agent）
- 匿名用户：`myAgents` 返回空数组，`publicAgents` 返回所有公开Agent

**响应：**
```json
{
  "success": true,
  "data": {
    "myAgents": [
      {
        "id": "agent_001",
        "name": "我的助手",
        "description": "日常问答助手",
        "templateId": "basic-loop",
        "templateConfig": { "stepCount": 20 },
        "systemPrompt": "你是一个有帮助的助手...",
        "modelId": "model_001",
        "isPublic": false,
        "tools": [
          { "id": "tool_001", "name": "bash", "serverName": "沙盒服务" }
        ],
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000
      }
    ],
    "publicAgents": [
      {
        "id": "agent_002",
        "name": "代码专家",
        "description": "专注代码问题",
        "templateId": "basic-loop",
        "templateConfig": { "stepCount": 30 },
        "systemPrompt": "你是一个代码专家...",
        "modelId": null,
        "isPublic": true,
        "creator": {
          "id": "user_002",
          "username": "张三"
        },
        "tools": [],
        "createdAt": 1700000000000
      }
    ]
  }
}
```

### 4.3 POST /api/agents

创建新Agent。

**请求：**
```json
{
  "name": "我的助手",
  "description": "日常问答助手",
  "templateId": "basic-loop",
  "templateConfig": { "stepCount": 20 },
  "systemPrompt": "你是一个有帮助的助手...",
  "modelId": "model_001",
  "toolIds": ["tool_001", "tool_002"]
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "agent_003",
    "userId": "user_001",
    "name": "我的助手",
    ...
  }
}
```

### 4.4 权限控制

**认证方式：**
- GET 请求：使用 `authenticateRequestOptional`，支持登录用户和匿名用户
- POST/PUT/DELETE/PATCH：使用 `authenticateRequest`，仅允许登录用户

**权限校验：**
- **匿名用户**：仅允许 GET 请求，返回空 `myAgents` 和完整 `publicAgents`
- **登录用户**：可操作自己的Agent（检查 `user_id` 匹配）
- **公开Agent**：所有用户可查看详情，但仅创建者可编辑/删除

**实现示例：**
```typescript
// GET /api/agents - 使用 authenticateRequestOptional
const { userId, isRegistered } = await authenticateRequestOptional(request);

// POST /api/agents - 使用 authenticateRequest
const userId = await authenticateRequest(request);
```

---

## 5. 页面设计

### 5.1 路由

```
/settings/agents - Agent配置页面
```

### 5.2 页面结构

页面分为两个主要区域：

1. **我的Agent** - 展示当前用户创建的Agent列表
   - 匿名用户显示空状态提示
   - 登录用户可新建、编辑、删除Agent
   - 可切换公开/私有状态

2. **公开Agent** - 展示所有用户公开的Agent
   - 所有用户可见
   - 只读模式，点击查看详情
   - 显示创建者信息

### 5.3 交互设计

**新建/编辑Agent弹窗：**
- Agent名称（必填）
- 描述（可选）
- Agent模板（下拉选择，必填）
- 模板配置（根据模板动态渲染）
- 系统提示词（多行文本）
- 关联模型（下拉选择用户模型）
- 关联工具（多选MCP工具）

**查看公开Agent详情：**
- 只读模式展示所有属性
- 显示创建者信息
- 无编辑/复制按钮

---

## 6. Agent模板设计

### 6.1 模板定义文件

位置：`lib/agents/templates.ts`

### 6.2 模板接口

```typescript
interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  configFields: TemplateConfigField[];
  defaultConfig: Record<string, unknown>;
  createStopCondition: (config: Record<string, unknown>) => unknown;
}

interface TemplateConfigField {
  key: string;
  label: string;
  type: "number" | "string" | "boolean" | "select";
  defaultValue: unknown;
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
}
```

### 6.3 基础循环模板

本期仅实现一个模板：`basic-loop`

```typescript
const BASIC_LOOP_TEMPLATE: AgentTemplate = {
  id: "basic-loop",
  name: "基础循环模板",
  description: "使用步骤计数控制Agent执行循环",
  configFields: [
    {
      key: "stepCount",
      label: "步骤上限",
      type: "number",
      defaultValue: 20,
      required: true,
      min: 1,
      max: 100,
    },
  ],
  defaultConfig: { stepCount: 20 },
  createStopCondition: (config) => stepCountIs(config.stepCount),
};
```

### 6.4 扩展方式

后续添加新模板时：
1. 在 `AGENT_TEMPLATES` 数组中添加新模板定义
2. 实现 `createStopCondition` 函数
3. 前端自动通过 `configFields` 渲染配置表单

---

## 7. 文件结构

```
app/
├── settings/
│   └── agents/
│       └── page.tsx                    # Agent配置页面

app/api/
├── agents/
│   ├── route.ts                        # GET列表 / POST创建
│   └── [id]/
│       ├── route.ts                    # GET/PUT/DELETE详情
│       └── publish/
│           └── route.ts                # PATCH公开/私有

components/settings/
├── agent-list.tsx                      # Agent列表组件
├── agent-card.tsx                      # Agent卡片组件
├── agent-form.tsx                      # Agent表单弹窗
├── agent-detail-dialog.tsx             # Agent详情弹窗
└── agent-template-config.tsx           # 模板配置动态渲染

lib/
├── db/
│   ├── schema.ts                       # 新增agents、agent_tools表定义
│   └── agents.ts                       # Agent数据访问方法
├── hooks/
│   └── use-agents.ts                   # Agent管理Hook
└── agents/
    ├── config.ts                       # 现有Agent配置（保留）
    ├── templates.ts                    # 新增：模板定义
    └── index.ts                        # 导出
```

---

## 8. 迁移策略

### 8.1 数据库迁移

在 `lib/db/index.ts` 中添加迁移逻辑：

1. 创建 `agents` 表
2. 创建 `agent_tools` 表
3. 创建相关索引

### 8.2 兼容性

- 不修改现有的 `conversations` 表结构
- 现有的 `agent_id` 字段（默认值 `production`）保持不变
- 新的Agent系统与旧逻辑完全独立

---

## 9. 测试要点

### 9.1 功能测试

- [ ] 登录用户可创建Agent
- [ ] 登录用户可编辑/删除自己的Agent
- [ ] 登录用户可切换Agent公开/私有状态
- [ ] 匿名用户可查看公开Agent列表
- [ ] 匿名用户不可创建Agent
- [ ] 匿名用户查看公开Agent为只读
- [ ] Agent关联工具正确保存和读取

### 9.2 权限测试

- [ ] 非创建者无法编辑/删除他人Agent
- [ ] 未登录用户访问创建接口返回401
- [ ] 公开Agent可被所有用户查看

### 9.3 边界测试

- [ ] Agent名称为空时提交失败
- [ ] 模板配置超出范围时校验失败
- [ ] 删除Agent时关联的agent_tools记录级联删除

---

## 10. 后续规划

### Phase 2: AgentChat页面

- 新增 `/agent-chat` 页面
- 选择Agent后进行对话
- Agent使用配置中的模型和工具
- 复用现有会话和消息存储

### Phase 3: 云端沙盒工具集成

- 对接沙盒服务API
- 实现内置工具：bash、readFile、writeFile
- 用户数据隔离和持久化

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2026-03-22 | 初始设计文档 |
| 1.0.1 | 2026-03-22 | 补充API响应逻辑、权限控制方式、匿名用户处理、唯一约束 |