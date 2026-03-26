# 系统工具可选配置设计

## 背景

当前 Agent 的工具关联设计存在问题：
- `agent_tools.tool_id` 有外键约束引用 `mcp_tools(id)`
- 系统工具（bash、readFile、writeFile）是代码中硬编码的，不在数据库中
- 导致系统工具无法被选择性启用/禁用

## 目标

- 用户可以在 Agent 配置时选择启用/禁用系统工具
- 默认行为：所有系统工具默认启用
- 与 MCP 工具统一展示和管理

## 设计方案

### 1. 数据库变更

**agents 表新增字段**：

```sql
ALTER TABLE agents ADD COLUMN enabled_system_tools TEXT;
```

- 存储格式：JSON数组字符串
- 示例：`'["system:sandbox:bash", "system:sandbox:readFile"]'`
- NULL 或空数组表示不启用任何系统工具
- 默认值：在应用层设置，数据库字段允许 NULL

**迁移逻辑**：
- 新建 Agent 时，应用层设置默认值为所有系统工具
- 现有 Agent 迁移时，`enabled_system_tools` 设为 NULL，读取时默认返回所有系统工具（向后兼容）

### 2. 常量定义

```typescript
// lib/constants/system-tools.ts

/**
 * 系统工具ID列表
 * 所有系统工具的ID必须以 'system:' 开头
 */
export const SYSTEM_TOOL_IDS = [
  'system:sandbox:bash',
  'system:sandbox:readFile',
  'system:sandbox:writeFile',
] as const;

export type SystemToolId = typeof SYSTEM_TOOL_IDS[number];

/**
 * 获取所有系统工具的默认列表
 */
export function getDefaultSystemTools(): SystemToolId[] {
  return [...SYSTEM_TOOL_IDS];
}

/**
 * 验证并过滤有效的系统工具ID
 * @param toolIds - 待验证的工具ID列表
 * @returns 有效的系统工具ID列表
 */
export function validateSystemToolIds(toolIds: string[]): SystemToolId[] {
  return toolIds.filter((id): id is SystemToolId =>
    SYSTEM_TOOL_IDS.includes(id as SystemToolId)
  );
}
```

### 3. 字段命名转换策略

| 层级 | 字段名 | 格式 |
|------|--------|------|
| 数据库 | enabled_system_tools | snake_case |
| API 请求/响应 | enabledSystemTools | camelCase |
| 前端组件 | enabledSystemTools | camelCase |

数据访问层（`lib/db/agents.ts`）负责转换：
- 写入时：`enabledSystemTools` → `enabled_system_tools`（JSON序列化）
- 读取时：`enabled_system_tools` → `enabledSystemTools`（JSON解析）

### 4. API 变更

**创建 Agent (POST /api/agents)**：
- 接收 `enabledSystemTools?: string[]` 参数（可选）
- 未提供时，默认为所有系统工具
- 验证输入，过滤无效的工具ID

**更新 Agent (PUT /api/agents/:id)**：
- 接收 `enabledSystemTools?: string[]` 参数（可选）
- 提供时验证并过滤无效ID

**获取 Agent (GET /api/agents, GET /api/agents/:id)**：
- 返回 `enabledSystemTools` 字段
- `tools` 字段合并 MCP 工具和启用的系统工具
- 系统工具的 `source` 字段为 `'system'`，无 `serverName`

### 5. 错误处理

**JSON 解析失败处理**：
```typescript
function parseSystemTools(jsonStr: string | null): SystemToolId[] {
  if (!jsonStr) {
    return getDefaultSystemTools(); // 向后兼容
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return getDefaultSystemTools();
    }
    return validateSystemToolIds(parsed);
  } catch {
    return getDefaultSystemTools(); // 解析失败时返回默认值
  }
}
```

**无效工具ID处理**：
- 静默忽略无效ID，只保留有效的系统工具ID
- 不抛出错误，保证API稳定性

### 6. 前端变更

**AgentForm 组件**：
- 工具列表分组显示：系统工具在前，MCP工具在后
- 系统工具组标签显示"系统工具（沙盒环境）"
- 系统工具的勾选状态存储在 `enabledSystemTools` 字段
- 创建新 Agent 时，系统工具默认全部勾选
- **禁用所有系统工具时显示警告**："禁用所有系统工具可能导致 Agent 无法正常执行任务"

**AgentCard 组件**：
- 显示已启用的系统工具数量，如"3 个系统工具"
- 系统工具图标与 MCP 工具区分

### 7. 类型定义变更

```typescript
// schema.ts

/**
 * Agent类型定义
 */
export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_id: string;
  template_config: string | null;
  system_prompt: string | null;
  model_id: string | null;
  is_public: boolean;
  // 新增：启用的系统工具ID列表（JSON字符串）
  enabled_system_tools: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Agent详情响应类型（包含工具信息）
 */
export interface AgentWithTools extends Omit<Agent, 'enabled_system_tools'> {
  tools: Array<{
    id: string;
    name: string;
    source: 'system' | 'mcp';
    serverName?: string;
  }>;
  // 新增：启用的系统工具ID列表（已解析）
  enabledSystemTools: string[];
}

/**
 * 创建Agent的参数类型
 */
export interface CreateAgentParams {
  id: string;
  userId: string;
  name: string;
  description?: string;
  templateId: string;
  templateConfig?: Record<string, unknown>;
  systemPrompt?: string;
  modelId?: string;
  toolIds?: string[];
  // 新增：启用的系统工具ID列表
  enabledSystemTools?: string[];
}

/**
 * 更新Agent的参数类型
 */
export interface UpdateAgentParams {
  name?: string;
  description?: string | null;
  templateId?: string;
  templateConfig?: Record<string, unknown>;
  systemPrompt?: string | null;
  modelId?: string | null;
  toolIds?: string[];
  // 新增：启用的系统工具ID列表
  enabledSystemTools?: string[];
}
```

## 实现步骤

1. **数据库迁移**：添加 `enabled_system_tools` 字段
2. **创建常量文件**：定义系统工具ID常量和验证函数
3. **更新类型定义**：修改 `schema.ts`
4. **更新数据访问层**：修改 `lib/db/agents.ts`
5. **更新 API 路由**：修改 `app/api/agents/route.ts`
6. **更新前端组件**：修改 `AgentForm` 和 `AgentCard`

## 系统工具列表

当前系统工具（定义在 `app/api/tools/route.ts`）：

| ID | 名称 | 描述 |
|----|------|------|
| system:sandbox:bash | bash | 在沙盒环境中执行 bash 命令 |
| system:sandbox:readFile | readFile | 读取沙盒工作空间中的文件内容 |
| system:sandbox:writeFile | writeFile | 写入文件到沙盒工作空间 |

## 向后兼容

- 现有 Agent 的 `enabled_system_tools` 为 NULL
- 读取时，NULL 值默认返回所有系统工具
- API 返回格式保持兼容，仅新增 `enabledSystemTools` 字段

## 安全性考虑

- 用户可以禁用所有系统工具（设计允许）
- 禁用时前端显示警告，但不阻止操作
- 某些 Agent 模板可能不需要系统工具（如纯对话型 Agent）