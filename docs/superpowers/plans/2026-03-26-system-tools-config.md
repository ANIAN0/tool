# 系统工具可选配置实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现系统工具在 Agent 配置时可选择启用/禁用，默认全部启用。

**Architecture:** 在 agents 表新增 `enabled_system_tools` 字段存储启用的系统工具ID列表，数据访问层负责 JSON 序列化/反序列化，前端组件分组展示系统工具和 MCP 工具。

**Tech Stack:** TypeScript, Next.js, React, SQLite/Turso

---

## Chunk 1: 基础设施（常量和数据库）

### Task 1: 创建系统工具常量文件

**Files:**
- Create: `lib/constants/system-tools.ts`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p lib/constants
```

- [ ] **Step 2: 创建常量文件**

```typescript
/**
 * 系统工具常量定义
 * 系统工具是平台内置能力，所有工具ID以 'system:' 开头
 */

/**
 * 系统工具ID列表
 * 所有系统工具的ID必须以 'system:' 开头
 */
export const SYSTEM_TOOL_IDS = [
  'system:sandbox:bash',
  'system:sandbox:readFile',
  'system:sandbox:writeFile',
] as const;

/**
 * 系统工具ID类型
 */
export type SystemToolId = typeof SYSTEM_TOOL_IDS[number];

/**
 * 获取所有系统工具的默认列表
 * @returns 系统工具ID数组的副本
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

/**
 * 解析数据库中存储的系统工具JSON字符串
 * @param jsonStr - JSON字符串或null
 * @returns 系统工具ID数组，解析失败时返回默认值
 */
export function parseSystemTools(jsonStr: string | null): SystemToolId[] {
  // NULL 值返回默认值（向后兼容）
  if (!jsonStr) {
    return getDefaultSystemTools();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // 非数组类型返回默认值
    if (!Array.isArray(parsed)) {
      console.warn('enabled_system_tools 不是数组格式，使用默认值');
      return getDefaultSystemTools();
    }

    // 过滤有效的系统工具ID
    return validateSystemToolIds(parsed);
  } catch (error) {
    // JSON解析失败时返回默认值
    console.warn('解析 enabled_system_tools 失败:', error);
    return getDefaultSystemTools();
  }
}

/**
 * 序列化系统工具ID列表为JSON字符串
 * @param toolIds - 系统工具ID数组
 * @returns JSON字符串
 */
export function serializeSystemTools(toolIds: string[]): string {
  return JSON.stringify(validateSystemToolIds(toolIds));
}

/**
 * 检查是否为系统工具ID
 * @param toolId - 工具ID
 * @returns 是否为系统工具
 */
export function isSystemToolId(toolId: string): boolean {
  return toolId.startsWith('system:');
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/constants/system-tools.ts
git commit -m "feat: 添加系统工具常量和工具函数"
```

---

### Task 2: 数据库迁移 - 添加 enabled_system_tools 字段

**Files:**
- Modify: `scripts/init-db.ts`

- [ ] **Step 1: 在 migrateDatabase 函数末尾添加迁移逻辑**

在 `scripts/init-db.ts` 的 `migrateDatabase` 函数中，找到最后一个迁移（迁移12: 添加source字段）之后，添加新的迁移：

```typescript
// 迁移13: 添加 enabled_system_tools 字段到 agents 表
if (await tableExists(db, "agents")) {
  if (!(await columnExists(db, "agents", "enabled_system_tools"))) {
    console.log("添加 enabled_system_tools 字段到 agents 表...");
    await db.execute(
      "ALTER TABLE agents ADD COLUMN enabled_system_tools TEXT"
    );
    console.log("✅ enabled_system_tools 字段添加成功");
  } else {
    console.log("✅ enabled_system_tools 字段已存在，跳过迁移");
  }
}
```

- [ ] **Step 2: 运行迁移**

```bash
npx tsx scripts/init-db.ts migrate
```

Expected: 输出包含 "✅ enabled_system_tools 字段添加成功" 或 "已存在"

- [ ] **Step 3: Commit**

```bash
git add scripts/init-db.ts
git commit -m "feat: 添加 enabled_system_tools 字段迁移"
```

---

## Chunk 2: 类型定义和数据访问层

### Task 3: 更新 schema.ts 类型定义

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: 更新 Agent 接口**

找到 `Agent` 接口定义（约第609行），添加 `enabled_system_tools` 字段：

```typescript
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
```

- [ ] **Step 2: 更新 AgentWithTools 接口**

找到 `AgentWithTools` 接口定义，修改为：

```typescript
/**
 * Agent详情响应类型（包含工具信息）
 * 注意：enabled_system_tools 在数据库层是 snake_case，API 层转换为 camelCase
 */
export interface AgentWithTools extends Omit<Agent, 'enabled_system_tools'> {
  tools: Array<{
    id: string;
    name: string;
    source: 'system' | 'mcp';
    serverName?: string;
  }>;
  // 启用的系统工具ID列表（已解析为数组）
  enabledSystemTools: string[];
}
```

- [ ] **Step 3: 更新 PublicAgentWithCreator 接口**

找到 `PublicAgentWithCreator` 接口定义，修改为继承更新后的类型：

```typescript
/**
 * 公开Agent响应类型（包含创建者信息）
 */
export interface PublicAgentWithCreator extends AgentWithTools {
  creator?: {
    id: string;
    username: string | null;
  };
}
```

- [ ] **Step 4: 更新 CreateAgentParams 接口**

找到 `CreateAgentParams` 接口定义，添加字段：

```typescript
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
```

- [ ] **Step 5: 更新 UpdateAgentParams 接口**

找到 `UpdateAgentParams` 接口定义，添加字段：

```typescript
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

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: 更新 Agent 类型定义，添加 enabled_system_tools 字段"
```

---

### Task 4: 更新数据访问层 lib/db/agents.ts

**Files:**
- Modify: `lib/db/agents.ts`

- [ ] **Step 1: 添加导入**

在文件顶部添加导入：

```typescript
import {
  getDefaultSystemTools,
  parseSystemTools,
  serializeSystemTools,
  isSystemToolId,
} from "@/lib/constants/system-tools";
```

- [ ] **Step 2: 更新 mapRowToAgent 函数**

修改 `mapRowToAgent` 函数，添加 `enabled_system_tools` 字段：

```typescript
/**
 * 将数据库行转换为Agent对象
 */
function mapRowToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: row.description as string | null,
    template_id: row.template_id as string,
    template_config: row.template_config as string | null,
    system_prompt: row.system_prompt as string | null,
    model_id: row.model_id as string | null,
    is_public: (row.is_public as number) === 1,
    enabled_system_tools: row.enabled_system_tools as string | null,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}
```

- [ ] **Step 3: 添加辅助函数构建 AgentWithTools**

在 `mapRowToAgent` 函数之后添加：

```typescript
/**
 * 将 Agent 数据库记录转换为 AgentWithTools 响应格式
 * @param agent - Agent 数据库记录
 * @param mcpTools - MCP工具列表
 * @returns AgentWithTools 格式的对象
 */
function buildAgentWithTools(
  agent: Agent,
  mcpTools: Array<{ id: string; name: string; serverName?: string }>
): AgentWithTools {
  // 解析系统工具
  const enabledSystemTools = parseSystemTools(agent.enabled_system_tools);

  // 构建工具列表：合并 MCP 工具和启用的系统工具
  // 系统工具需要标记 source 字段
  const systemToolsWithSource = enabledSystemTools.map((id) => ({
    id,
    name: id.replace('system:sandbox:', ''),
    source: 'system' as const,
  }));

  const mcpToolsWithSource = mcpTools.map((t) => ({
    ...t,
    source: 'mcp' as const,
  }));

  return {
    ...agent,
    enabledSystemTools,
    tools: [...systemToolsWithSource, ...mcpToolsWithSource],
  };
}
```

- [ ] **Step 4: 更新 createAgent 函数**

修改 `createAgent` 函数，添加 `enabled_system_tools` 字段处理：

```typescript
/**
 * 创建新Agent
 * 同时创建工具关联
 */
export async function createAgent(params: CreateAgentParams): Promise<Agent> {
  const db = getDb();
  const now = Date.now();

  // 序列化template_config为JSON字符串
  const templateConfigJson = params.templateConfig
    ? JSON.stringify(params.templateConfig)
    : null;

  // 序列化enabledSystemTools为JSON字符串
  // 未提供时使用默认值（所有系统工具）
  const enabledSystemToolsJson = serializeSystemTools(
    params.enabledSystemTools || getDefaultSystemTools()
  );

  // 插入Agent记录
  await db.execute({
    sql: `INSERT INTO agents
          (id, user_id, name, description, template_id, template_config, system_prompt, model_id, is_public, enabled_system_tools, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.userId,
      params.name,
      params.description ?? null,
      params.templateId,
      templateConfigJson,
      params.systemPrompt ?? null,
      params.modelId ?? null,
      0, // 默认私有
      enabledSystemToolsJson,
      now,
      now,
    ],
  });

  // 如果有工具ID，创建关联
  if (params.toolIds && params.toolIds.length > 0) {
    await insertAgentTools(params.id, params.toolIds);
  }

  return {
    id: params.id,
    user_id: params.userId,
    name: params.name,
    description: params.description ?? null,
    template_id: params.templateId,
    template_config: templateConfigJson,
    system_prompt: params.systemPrompt ?? null,
    model_id: params.modelId ?? null,
    is_public: false,
    enabled_system_tools: enabledSystemToolsJson,
    created_at: now,
    updated_at: now,
  };
}
```

- [ ] **Step 5: 更新 getAgentById 函数**

修改 `getAgentById` 函数返回值：

```typescript
/**
 * 根据ID获取Agent详情（包含工具信息）
 */
export async function getAgentById(
  agentId: string,
  userId?: string
): Promise<AgentWithTools | null> {
  const db = getDb();

  // 查询Agent
  const result = await db.execute({
    sql: "SELECT * FROM agents WHERE id = ?",
    args: [agentId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const agent = mapRowToAgent(result.rows[0]);

  // 如果提供了userId，验证访问权限（创建者或公开Agent）
  if (userId && agent.user_id !== userId && !agent.is_public) {
    return null;
  }

  // 获取关联的 MCP 工具
  const mcpTools = await getAgentTools(agentId);

  return buildAgentWithTools(agent, mcpTools);
}
```

- [ ] **Step 6: 更新 getAgentsByUserId 函数**

修改 `getAgentsByUserId` 函数：

```typescript
/**
 * 获取用户的所有Agent
 * 使用批量查询优化，避免N+1问题
 */
export async function getAgentsByUserId(userId: string): Promise<AgentWithTools[]> {
  const db = getDb();

  // 查询用户的所有Agent
  const result = await db.execute({
    sql: `SELECT * FROM agents
          WHERE user_id = ?
          ORDER BY updated_at DESC`,
    args: [userId],
  });

  // 提取所有Agent ID
  const agentIds = result.rows.map((row) => row.id as string);

  // 批量获取所有Agent的工具信息（一次性查询）
  const toolsMap = await getAgentsToolsBatch(agentIds);

  // 组装结果
  return result.rows.map((row) => {
    const agent = mapRowToAgent(row);
    const mcpTools = toolsMap.get(agent.id) || [];
    return buildAgentWithTools(agent, mcpTools);
  });
}
```

- [ ] **Step 7: 更新 updateAgent 函数**

**注意：现有函数参数顺序是 `(userId, agentId, params)`，保持不变！**

在现有 `updateAgent` 函数中添加 `enabledSystemTools` 更新逻辑。找到更新字段构建部分，添加：

```typescript
// 在现有更新字段构建部分添加：
if (params.enabledSystemTools !== undefined) {
  updates.push("enabled_system_tools = ?");
  args.push(serializeSystemTools(params.enabledSystemTools));
}
```

- [ ] **Step 8: 更新 getPublicAgents 函数**

修改 `getPublicAgents` 函数，使用 `buildAgentWithTools`：

```typescript
/**
 * 获取所有公开的Agent（排除指定用户的）
 * 用于发现/市场页面
 * 使用批量查询优化，避免N+1问题
 */
export async function getPublicAgents(
  excludeUserId?: string
): Promise<PublicAgentWithCreator[]> {
  const db = getDb();

  // 查询公开的Agent，可选择排除某用户
  let sql = `
    SELECT a.*, u.username as creator_username
    FROM agents a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.is_public = 1
  `;
  const args: string[] = [];

  if (excludeUserId) {
    sql += " AND a.user_id != ?";
    args.push(excludeUserId);
  }

  sql += " ORDER BY a.updated_at DESC";

  const result = await db.execute({ sql, args });

  // 提取所有Agent ID
  const agentIds = result.rows.map((row) => row.id as string);

  // 批量获取工具信息
  const toolsMap = await getAgentsToolsBatch(agentIds);

  // 组装结果
  return result.rows.map((row) => {
    const agent = mapRowToAgent(row);
    const mcpTools = toolsMap.get(agent.id) || [];
    const agentWithTools = buildAgentWithTools(agent, mcpTools);

    return {
      ...agentWithTools,
      creator: {
        id: agent.user_id,
        username: row.creator_username as string | null,
      },
    };
  });
}
```

- [ ] **Step 9: Commit**

```bash
git add lib/db/agents.ts
git commit -m "feat: 更新数据访问层支持 enabled_system_tools"
```

---

## Chunk 3: API 路由

### Task 5: 更新 API 路由 app/api/agents/route.ts

**Files:**
- Modify: `app/api/agents/route.ts`

- [ ] **Step 1: 更新 POST 请求处理**

修改 `POST` 函数中的请求解析和创建逻辑：

```typescript
// 解析请求体
const body = await request.json();
const {
  name,
  description,
  templateId,
  templateConfig,
  systemPrompt,
  modelId,
  toolIds,
  enabledSystemTools, // 新增
} = body;

// ... 验证逻辑保持不变 ...

// 创建Agent
const agent = await createAgent({
  id: agentId,
  userId,
  name: name.trim(),
  description: description?.trim() || undefined,
  templateId,
  templateConfig: templateConfig || undefined,
  systemPrompt: systemPrompt?.trim() || undefined,
  modelId: modelId || undefined,
  toolIds: toolIds || undefined,
  enabledSystemTools: enabledSystemTools || undefined, // 新增
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/agents/route.ts
git commit -m "feat: API 支持 enabledSystemTools 参数"
```

---

### Task 6: 更新 PUT 路由 app/api/agents/[id]/route.ts

**Files:**
- Modify: `app/api/agents/[id]/route.ts`

- [ ] **Step 1: 检查并更新 PUT 处理**

找到文件，确保 `updateAgent` 调用包含 `enabledSystemTools` 参数。

**注意：现有调用顺序是 `updateAgent(userId, id, updateParams)`，保持不变！**

```typescript
// 在 PUT 函数中添加 enabledSystemTools 参数
const {
  name,
  description,
  templateId,
  templateConfig,
  systemPrompt,
  modelId,
  toolIds,
  enabledSystemTools, // 新增
} = body;

// 更新Agent
const updatedAgent = await updateAgent(userId, id, {
  name: name?.trim(),
  description: description?.trim(),
  templateId,
  templateConfig,
  systemPrompt: systemPrompt?.trim(),
  modelId,
  toolIds,
  enabledSystemTools, // 新增
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/agents/[id]/route.ts
git commit -m "feat: PUT API 支持 enabledSystemTools 参数"
```

---

## Chunk 4: 前端组件

### Task 7: 更新 AgentForm 组件

**Files:**
- Modify: `components/settings/agent-form.tsx`

- [ ] **Step 1: 添加导入**

```typescript
import { getDefaultSystemTools, SYSTEM_TOOL_IDS } from "@/lib/constants/system-tools";
```

- [ ] **Step 2: 更新 AgentFormData 接口**

```typescript
/**
 * Agent表单数据接口
 */
export interface AgentFormData {
  // Agent名称
  name: string;
  // Agent描述
  description: string;
  // 模板ID
  templateId: string;
  // 模板配置
  templateConfig: Record<string, unknown>;
  // 系统提示词
  systemPrompt: string;
  // 模型ID
  modelId: string;
  // MCP工具ID列表
  toolIds: string[];
  // 新增：启用的系统工具ID列表
  enabledSystemTools: string[];
}
```

- [ ] **Step 3: 更新 DEFAULT_FORM_DATA**

```typescript
/**
 * 默认表单数据
 */
const DEFAULT_FORM_DATA: AgentFormData = {
  name: "",
  description: "",
  templateId: "basic-loop",
  templateConfig: { stepCount: 20 },
  systemPrompt: "",
  modelId: "",
  toolIds: [],
  enabledSystemTools: getDefaultSystemTools(), // 新增：默认启用所有系统工具
};
```

- [ ] **Step 4: 更新 useEffect 初始化逻辑**

在编辑模式下初始化表单时，添加 `enabledSystemTools` 字段：

```typescript
// 在 useEffect 中，编辑模式的表单初始化
setFormData({
  name: agent.name,
  description: agent.description || "",
  templateId: agent.template_id,
  templateConfig: parseTemplateConfig(agent.template_config, agent.template_id),
  systemPrompt: agent.system_prompt || "",
  modelId: agent.model_id || "",
  toolIds: agent.tools.filter(t => t.source === 'mcp').map((t) => t.id),
  enabledSystemTools: agent.enabledSystemTools || getDefaultSystemTools(), // 新增
});
```

- [ ] **Step 5: 添加系统工具切换处理函数**

```typescript
/**
 * 处理系统工具选择切换
 */
const handleSystemToolToggle = useCallback((toolId: string, checked: boolean) => {
  setFormData((prev) => ({
    ...prev,
    enabledSystemTools: checked
      ? [...prev.enabledSystemTools, toolId]
      : prev.enabledSystemTools.filter((id) => id !== toolId),
  }));
}, []);
```

- [ ] **Step 6: 更新工具选择部分 UI**

找到工具选择部分（约第440行），修改为分组显示：

**重要说明**：系统工具选项列表应使用 `SYSTEM_TOOL_IDS` 常量渲染，而非从 `tools` 数组过滤，因为 `tools` 数组只包含已启用的工具。

```typescript
{/* 工具选择 */}
<div className="space-y-2">
  <Label>工具</Label>
  {isLoadingTools ? (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      加载工具列表中...
    </div>
  ) : (
    <div className="space-y-4">
      {/* 系统工具组 - 使用常量渲染所有可用系统工具 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">系统工具（沙盒环境）</span>
          {formData.enabledSystemTools.length === 0 && (
            <span className="text-xs text-amber-600">
              禁用所有系统工具可能导致 Agent 无法正常执行任务
            </span>
          )}
        </div>
        <div className="border rounded-md p-3 bg-muted/30">
          <div className="space-y-3">
            {SYSTEM_TOOL_IDS.map((toolId) => {
              // 从 tools 数组获取工具详情（描述等）
              const toolInfo = tools.find((t) => t.id === toolId);
              const toolName = toolId.replace('system:sandbox:', '');

              return (
                <div key={toolId} className="flex items-start space-x-2">
                  <Checkbox
                    id={`system-tool-${toolId}`}
                    checked={formData.enabledSystemTools.includes(toolId)}
                    onCheckedChange={(checked) =>
                      handleSystemToolToggle(toolId, checked as boolean)
                    }
                  />
                  <div className="grid gap-1 leading-none">
                    <label
                      htmlFor={`system-tool-${toolId}`}
                      className="text-sm font-medium leading-none"
                    >
                      {toolName}
                    </label>
                    {toolInfo?.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {toolInfo.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MCP工具组 */}
      {tools.filter((tool) => tool.source === "mcp").length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">MCP 工具</span>
          <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto">
            <div className="space-y-3">
              {tools
                .filter((tool) => tool.source === "mcp")
                .map((tool) => (
                  <div key={tool.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={`mcp-tool-${tool.id}`}
                      checked={formData.toolIds.includes(tool.id)}
                      onCheckedChange={(checked) =>
                        handleToolToggle(tool.id, checked as boolean)
                      }
                      disabled={!tool.isAvailable}
                    />
                    <div className="grid gap-1 leading-none">
                      <label
                        htmlFor={`mcp-tool-${tool.id}`}
                        className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                          !tool.isAvailable ? "text-muted-foreground" : ""
                        }`}
                      >
                        {tool.name}
                        {tool.server && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({tool.server.name})
                          </span>
                        )}
                      </label>
                      {tool.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {tool.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 无 MCP 工具提示 */}
      {tools.filter((tool) => tool.source === "mcp").length === 0 && (
        <p className="text-sm text-muted-foreground">暂无 MCP 工具</p>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 7: Commit**

```bash
git add components/settings/agent-form.tsx
git commit -m "feat: AgentForm 支持系统工具选择"
```

---

### Task 8: 更新 use-agents Hook

**Files:**
- Modify: `lib/hooks/use-agents.ts`

- [ ] **Step 1: 更新 CreateAgentInput 接口**

```typescript
/**
 * 创建 Agent 的参数（前端使用）
 * 与 schema 中的 CreateAgentParams 对应，但不需要 id 和 userId
 */
export interface CreateAgentInput {
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
```

- [ ] **Step 2: 更新 UpdateAgentInput 接口**

```typescript
/**
 * 更新 Agent 的参数（前端使用）
 */
export interface UpdateAgentInput {
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

- [ ] **Step 3: 更新 createAgent 函数调用**

在 `createAgent` 函数中添加 `enabledSystemTools` 参数：

```typescript
const createAgent = useCallback(
  async (params: CreateAgentInput): Promise<AgentWithTools | null> => {
    // ... 现有代码 ...

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ...params,
          enabledSystemTools: params.enabledSystemTools, // 新增
        }),
      });

      // ... 其余代码保持不变 ...
    }
  },
  [getAuthHeader]
);
```

- [ ] **Step 4: 更新 updateAgent 函数调用**

```typescript
const updateAgent = useCallback(
  async (id: string, params: UpdateAgentInput): Promise<boolean> => {
    // ... 现有代码 ...

    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ...params,
          enabledSystemTools: params.enabledSystemTools, // 新增
        }),
      });

      // ... 其余代码保持不变 ...
    }
  },
  [getAuthHeader]
);
```

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-agents.ts
git commit -m "feat: use-agents Hook 支持系统工具配置"
```

---

### Task 9: 更新 AgentCard 组件

**Files:**
- Modify: `components/settings/agent-card.tsx`

- [ ] **Step 1: 显示系统工具数量**

找到工具显示部分，添加系统工具数量显示：

```typescript
{/* 工具信息 */}
{agent.tools.length > 0 && (
  <div className="text-xs text-muted-foreground">
    {/* 区分系统工具和 MCP 工具 */}
    {(() => {
      const systemCount = agent.enabledSystemTools?.length ?? 0;
      const mcpCount = agent.tools.filter(t => t.source === 'mcp').length;

      const parts = [];
      if (systemCount > 0) {
        parts.push(`${systemCount} 个系统工具`);
      }
      if (mcpCount > 0) {
        parts.push(`${mcpCount} 个 MCP 工具`);
      }

      return parts.join(' · ') || '无工具';
    })()}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/settings/agent-card.tsx
git commit -m "feat: AgentCard 显示系统工具数量"
```

---

## Chunk 5: 测试与验证

### Task 10: 端到端测试

- [ ] **Step 1: 运行数据库迁移**

```bash
npx tsx scripts/init-db.ts migrate
```

Expected: 所有迁移成功，包含 `enabled_system_tools` 字段

- [ ] **Step 2: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 3: 测试创建 Agent**

1. 打开 Agent 管理页面
2. 点击"创建"按钮
3. 验证：
   - 系统工具默认全部勾选
   - 系统工具单独分组显示
   - 可取消勾选系统工具
   - 取消所有系统工具时显示警告

- [ ] **Step 4: 测试编辑 Agent**

1. 编辑已创建的 Agent
2. 验证：
   - 已保存的系统工具状态正确显示
   - 可修改系统工具选择

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: 完成系统工具可选配置功能"
```

---

## 文件变更总结

| 文件 | 操作 | 描述 |
|------|------|------|
| `lib/constants/system-tools.ts` | 新建 | 系统工具常量和工具函数 |
| `scripts/init-db.ts` | 修改 | 添加 enabled_system_tools 字段迁移 |
| `lib/db/schema.ts` | 修改 | 更新 Agent 相关类型定义 |
| `lib/db/agents.ts` | 修改 | 数据访问层支持新字段 |
| `app/api/agents/route.ts` | 修改 | API 支持 enabledSystemTools 参数 |
| `app/api/agents/[id]/route.ts` | 修改 | PUT API 支持新参数 |
| `components/settings/agent-form.tsx` | 修改 | 表单支持系统工具选择 |
| `lib/hooks/use-agents.ts` | 修改 | Hook 支持新参数 |
| `components/settings/agent-card.tsx` | 修改 | 显示系统工具数量 |

---

## 重要说明

### 函数参数顺序

现有代码中 `updateAgent` 和 `deleteAgent` 函数的参数顺序是 `(userId, agentId, params)`，本计划保持此顺序不变，确保与现有代码兼容。

### API 响应格式

`AgentWithTools` 类型已包含 `enabledSystemTools` 字段（camelCase），`lib/db/agents.ts` 中的 `buildAgentWithTools` 函数负责从数据库的 `enabled_system_tools`（snake_case）转换为 API 响应格式。