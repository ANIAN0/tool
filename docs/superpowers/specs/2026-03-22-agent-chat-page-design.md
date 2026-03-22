# AgentChat页面设计文档

> Phase 2: AgentChat页面设计与实现

## 1. 概述

### 1.1 背景

基于Phase 1完成的Agent配置管理功能，需要新增AgentChat页面，让用户可以选择配置好的Agent进行对话。

### 1.2 目标

- 用户可以选择自己的Agent或公开Agent进行对话
- Agent使用配置中的模型、提示词和工具
- 公开Agent共享创建者的模型能力
- 与现有chat页面完全独立

### 1.3 设计决策摘要

| 决策项 | 选择 |
|--------|------|
| 页面关系 | 完全独立 `/agent-chat` |
| 会话存储 | 复用现有 `conversations`/`messages` 表 |
| API端点 | 新建 `/api/agent-chat` |
| Agent切换 | 固定，创建对话时选择后不可切换 |
| 公开Agent | 直接使用，共享创建者的模型和API Key |
| Agent选择器 | 下拉选择器，分组显示 |
| 对话列表 | 仅显示Agent对话 |

### 1.4 范围

**Phase 2 包含：**
- AgentChat页面 (`/agent-chat`)
- Agent对话API (`/api/agent-chat`)
- Agent选择器（数据库驱动）
- 对话列表过滤（仅Agent对话）

**不在 Phase 2 范围：**
- 云端沙盒工具集成（Phase 3）
- 复杂的Agent模板扩展（后续版本）

---

## 2. 功能需求

### 2.1 用户权限

| 用户类型 | 权限 |
|----------|------|
| 登录用户 | 选择自己的Agent和公开Agent进行对话 |
| 匿名用户 | 仅选择公开Agent进行对话 |

### 2.2 核心功能

1. **Agent选择**：创建对话时选择Agent（我的Agent / 公开Agent）
2. **对话创建**：选择Agent后创建对话，Agent配置固化到对话
3. **消息交互**：使用Agent配置的模型、提示词、工具进行对话
4. **历史对话**：查看基于Agent的历史对话列表

### 2.3 Agent固定机制

- 创建对话时选择Agent
- 对话创建后Agent不可切换
- 已有对话的Agent选择器显示为禁用状态

### 2.4 公开Agent模型共享

公开Agent使用时共享创建者的模型能力：

| 场景 | 处理方式 |
|------|----------|
| Agent有model_id | 使用创建者配置的模型和API Key |
| Agent无model_id | 使用使用者的默认模型 |

**注意：** 创建者公开Agent时需知晓会共享其模型能力，承担公开Agent的使用费用。

### 2.5 匿名用户处理

- 匿名用户只能选择公开Agent
- 匿名用户无法看到"我的Agent"分组
- 匿名用户对话数据使用匿名ID存储

---

## 3. 数据库设计

### 3.1 复用现有表

复用 `conversations` 和 `messages` 表，通过 `agent_id` 和 `source` 字段区分。

### 3.2 新增字段

**conversations 表新增 `source` 字段：**

```sql
ALTER TABLE conversations ADD COLUMN source TEXT DEFAULT 'chat';
```

| source值 | 说明 |
|----------|------|
| `chat` | 旧chat页面创建的对话（默认值） |
| `agent-chat` | AgentChat页面创建的对话 |

### 3.3 数据隔离策略

| 数据来源 | 存储位置 | 说明 |
|----------|----------|------|
| 对话元数据 | `conversations` 表 | 复用现有结构，新增source字段 |
| 消息内容 | `messages` 表 | 复用现有结构 |
| Agent配置 | `agents` 表 | Phase 1已创建 |
| 模型配置 | `user_models` 表 | 现有结构，公开Agent时创建者模型被共享使用 |

### 3.4 对话查询逻辑

| 页面 | 查询条件 |
|------|----------|
| `/chat` | `source = 'chat'` 或 `source IS NULL`（兼容旧数据） |
| `/agent-chat` | `source = 'agent-chat'` |

---

## 4. API设计

### 4.1 新增API端点

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/agent-chat` | POST | Agent对话流式响应 |

### 4.2 POST /api/agent-chat

**请求头：**
```
Authorization: Bearer <token>           // 登录用户
X-Anonymous-Id: <anonymous_id>          // 匿名用户
```

**请求体：**
```json
{
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "parts": [{ "type": "text", "text": "你好" }]
    }
  ],
  "conversationId": "conv_001",
  "agentId": "agent_001"
}
```

**响应：**
流式响应（使用 `toUIMessageStreamResponse`）

### 4.3 核心处理逻辑

```
1. 解析请求，获取用户ID和Agent ID
2. 验证用户对Agent的访问权限
   - 私有Agent：验证 user_id 匹配
   - 公开Agent：验证 is_public = true
3. 获取Agent配置
   - 模板ID和配置
   - 系统提示词
   - 模型配置（公开Agent使用创建者的模型）
   - 工具列表
4. 创建对话（首次消息时）
   - 设置 source = 'agent-chat'
   - 设置 agent_id
5. 创建Agent实例并执行流式响应
6. 保存消息到数据库
```

### 4.4 权限控制

| Agent类型 | 权限检查 | 错误响应 |
|-----------|----------|----------|
| 我的Agent | 验证 `user_id` 匹配 | 403 Forbidden |
| 公开Agent | 验证 `is_public = true` | 403 Forbidden |
| 私有Agent（他人） | 拒绝访问 | 403 Forbidden |
| 不存在的Agent | - | 404 Not Found |

### 4.5 模型获取逻辑

```typescript
/**
 * 获取Agent使用的模型配置
 * @param agent - Agent配置
 * @param userId - 当前用户ID
 */
async function getAgentModel(agent: Agent, userId: string): Promise<ModelConfig> {
  if (agent.model_id) {
    // 使用Agent关联的模型（可能是创建者的模型）
    const model = await getUserModel(agent.model_id);
    if (!model) {
      throw new Error('Agent关联的模型不存在');
    }
    return {
      provider: model.provider,
      model: model.model,
      apiKey: model.api_key,
      baseUrl: model.base_url,
    };
  }

  // Agent未配置模型，使用用户默认模型
  const defaultModel = await getUserDefaultModel(userId);
  if (!defaultModel) {
    throw new Error('请先配置默认模型');
  }
  return defaultModel;
}
```

---

## 5. 页面设计

### 5.1 路由结构

```
/agent-chat           - 新对话页面
/agent-chat/[id]      - 已有对话页面
```

### 5.2 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│ ┌───────────┐ ┌───────────────────────────────────────────┐ │
│ │           │ │ 头部：[Agent名称]          [用户菜单]      │ │
│ │  侧边栏   │ ├───────────────────────────────────────────┤ │
│ │           │ │                                           │ │
│ │ [新建对话] │ │                                           │ │
│ │           │ │              消息列表                      │ │
│ │ 对话列表  │ │                                           │ │
│ │           │ │                                           │ │
│ │           │ ├───────────────────────────────────────────┤ │
│ │           │ │              输入区                        │ │
│ └───────────┘ └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Agent选择器设计

**位置：** 页面头部，对话标题旁

**分组显示：**
```
┌─────────────────────────────────┐
│ 选择Agent                       │
├─────────────────────────────────┤
│ 我的Agent                       │
│   ├─ 助手1号                    │
│   └─ 代码专家                   │
├─────────────────────────────────┤
│ 公开Agent                       │
│   ├─ 文档助手 (by 张三)         │
│   └─ 数据分析 (by 李四)         │
└─────────────────────────────────┘
```

**交互逻辑：**
- 新对话时：显示Agent选择器，选择后创建对话
- 已有对话：显示当前Agent名称，选择器禁用

**权限处理：**
- 登录用户：显示"我的Agent"和"公开Agent"两组
- 匿名用户：仅显示"公开Agent"一组

### 5.4 与现有chat页面的差异对比

| 功能 | `/chat` | `/agent-chat` |
|------|---------|---------------|
| Agent来源 | 代码定义（config.ts） | 数据库（agents表） |
| Agent切换 | 已有对话禁用 | 同样禁用 |
| 模型选择 | 可选择 | 隐藏，使用Agent配置 |
| 对话列表 | 所有chat对话 | 仅Agent对话 |
| 公开Agent | 不支持 | 支持，共享创建者模型 |
| source字段 | 'chat' | 'agent-chat' |

### 5.5 侧边栏对话列表

**查询逻辑：**
```typescript
// 仅查询 Agent 对话
const conversations = await getConversations(userId, { source: 'agent-chat' });
```

**显示内容：**
- 对话标题
- 关联的Agent名称
- 更新时间

---

## 6. 文件结构

```
app/
├── agent-chat/
│   ├── page.tsx                    # 新对话页面
│   ├── [id]/
│   │   └── page.tsx                # 已有对话页面
│   └── layout.tsx                  # 布局

app/api/
├── agent-chat/
│   └── route.ts                    # Agent对话API

components/agent-chat/
├── agent-chat-client.tsx           # 核心聊天组件
├── agent-selector.tsx              # Agent选择器（数据库版）
├── sidebar.tsx                     # 侧边栏
└── index.ts                        # 导出

lib/
├── agent-chat/
│   ├── index.ts                    # 导出
│   └── utils.ts                    # 工具函数
└── db/
    ├── schema.ts                   # 新增source字段定义
    └── conversations.ts            # 新增source过滤查询
```

---

## 7. 迁移策略

### 7.1 数据库迁移

在 `lib/db/index.ts` 中添加迁移逻辑：

```sql
ALTER TABLE conversations ADD COLUMN source TEXT DEFAULT 'chat';
```

### 7.2 兼容性

- 现有对话 `source` 字段为 `NULL` 或 `'chat'`
- `/chat` 页面查询条件包含 `source IS NULL OR source = 'chat'`
- 新建Agent对话设置 `source = 'agent-chat'`

---

## 8. 测试要点

### 8.1 功能测试

- [ ] 登录用户可选择自己的Agent创建对话
- [ ] 登录用户可选择公开Agent创建对话
- [ ] 匿名用户只能选择公开Agent创建对话
- [ ] 对话创建后Agent不可切换
- [ ] Agent使用配置的模型和提示词
- [ ] 公开Agent使用创建者的模型
- [ ] AgentChat侧边栏仅显示Agent对话

### 8.2 权限测试

- [ ] 非创建者无法使用私有Agent
- [ ] 公开Agent可被所有用户使用
- [ ] 未登录用户访问创建接口返回401

### 8.3 边界测试

- [ ] Agent不存在时返回404
- [ ] Agent关联的模型不存在时的处理
- [ ] 用户无默认模型时的提示

---

## 9. 后续规划

### Phase 3: 云端沙盒工具集成

- 对接沙盒服务API
- 实现内置工具：bash、readFile、writeFile
- 用户数据隔离和持久化

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2026-03-22 | 初始设计文档 |