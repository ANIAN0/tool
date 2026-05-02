# Skill 管理与加载说明

> 本文档记录 Skill 管理功能的完整实现，包括文件上传、校验、存储、Agent 关联、Skill 发现注册以及运行时加载到沙盒的流程。

## 系统概述 - Skill 生命周期

Skill 是一种可复用的能力模板，以 Markdown 文件（目录）形式存在，包含元数据和正文内容。其生命周期包括：

1. **创建**：用户上传 Skill 目录，系统校验后存储
2. **存储**：文件存入 Supabase Storage，元数据存入数据库
3. **关联**：将 Skill 与 Agent 建立多对多关联关系
4. **发现**：`lib/infra/skills/discovery.ts` 扫描 Skill 目录，解析 frontmatter，发现可用 Skill
5. **注册**：`lib/infra/skills/loader.ts` 将 Skill 定义注册到内存注册表，支持按需加载和执行
6. **工具化**：`lib/infra/skills/skill-tool.ts` 将 Skill 注册为 Agent 可用的 Tool
7. **服务层**：`lib/infra/skills/skill-service.ts` 从数据库加载 Agent 配置的 Skills 并注册到 ToolRegistry
8. **加载**：对话开始时，Skill 文件被加载到沙盒工作区

## 技术栈

- **前端**：Next.js App Router、React、Shadcn UI
- **后端**：Next.js API Routes、Turso（LibSQL）
- **存储**：Supabase Storage（skills bucket）
- **沙盒**：nsjail 进程隔离环境

## 目录

- [系统架构](#系统架构)
- [数据库设计](#数据库设计)
- [Supabase 存储集成](#supabase-存储集成)
- [后端实现](#后端实现)
- [运行时加载](#运行时加载)
- [Skill 工具实现](#skill-工具实现)
- [Skill 加载服务](#skill-加载服务)
- [前端实现](#前端实现)
- [使用指南](#使用指南)
- [注意事项](#注意事项)
- [相关文件清单](#相关文件清单)

## 系统架构

### Skill 完整流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill 管理完整流程                              │
└─────────────────────────────────────────────────────────────────────┘

                          ┌──────────────────┐
                          │   用户上传目录    │
                          │  (含 SKILL.md)   │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  validator.ts    │
                          │   校验目录格式    │
                          │   解析 frontmatter│
                          └─────────┬────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     │              │              │
                     ▼              ▼              ▼
             ┌───────────┐   ┌───────────┐   ┌───────────┐
             │ 名称校验  │   │ 大小校验  │   │ 格式校验  │
             │ (1-50字符)│   │ (≤5MB)   │   │(SKILL.md) │
             └───────────┘   └───────────┘   └───────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Supabase Storage │
                          │ skills/{userId}/ │
                          │    {skillName}/  │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │   user_skills    │
                          │   数据库表写入    │
                          │ (含 fileHash)    │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │   Agent 关联     │
                          │  agent_skills 表 │
                          └─────────┬────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                          ▼                   ▼
               ┌──────────────────┐  ┌──────────────────┐
               │ lib/infra/skills/│  │ lib/infra/skills/│
               │ discovery.ts    │  │ loader.ts        │
               │ Skill 发现与    │  │ Skill 注册与执行  │
               │ 元数据解析      │  │ 内存注册表管理    │
               └──────────────────┘  └──────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ lib/infra/skills/│
                          │ skill-tool.ts   │
                          │ Skill 工具实现   │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ lib/infra/skills/│
                          │ skill-service.ts│
                          │ Skill 加载服务   │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │   对话开始时      │
                          │  skill-loader    │
                          │ 加载到沙盒工作区  │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ 预置提示词注入    │
                          │ skills/{id}/...  │
                          └──────────────────┘
```

## 数据库设计

> 表结构定义位于 `lib/schemas/tool.ts`。

### skills 表（user_skills）

存储用户上传的 Skill 元数据（表结构定义位于 `lib/schemas/tool.ts`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，使用 Skill 名称作为 ID |
| user_id | TEXT | 用户 ID，外键关联 users 表 |
| name | TEXT | Skill 名称，来自 frontmatter |
| description | TEXT | Skill 描述，来自 frontmatter |
| metadata | TEXT | 完整元数据 JSON（含 frontmatter） |
| storage_path | TEXT | Supabase Storage 文件路径 |
| file_hash | TEXT | 目录整体 SHA256，用于版本检测 |
| file_size | INTEGER | 目录总大小（字节） |
| file_count | INTEGER | 文件数量（默认 1） |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

```sql
CREATE TABLE IF NOT EXISTS user_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,           -- 完整元数据 JSON（含 frontmatter）
  storage_path TEXT,       -- Supabase Storage 文件路径
  file_hash TEXT,          -- 文件 SHA256，用于版本检测
  file_size INTEGER,       -- 文件大小（字节）
  file_count INTEGER DEFAULT 1, -- 文件数量（目录中的文件总数）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_skills_name_user ON user_skills(user_id, name);
```

### agent_skills 关联表

Agent 与 Skill 的多对多关联（表结构定义位于 `lib/schemas/tool.ts`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，格式为 `{agentId}_{skillId}` |
| agent_id | TEXT | Agent ID，外键 |
| skill_id | TEXT | Skill ID，外键 |
| created_at | INTEGER | 创建时间戳 |

```sql
CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES user_skills(id) ON DELETE CASCADE,
  UNIQUE(agent_id, skill_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id);
```

### Skill 相关类型定义（lib/schemas/tool.ts）

`lib/schemas/tool.ts` 中定义了以下 Skill 相关类型：

| 类型名 | 说明 |
|--------|------|
| `UserSkill` | 用户上传的 Skill 元数据，对应 user_skills 表 |
| `AgentSkill` | Agent 与 Skill 的关联关系，对应 agent_skills 表 |
| `CreateUserSkillParams` | 创建 Skill 的参数类型 |
| `UpdateUserSkillParams` | 更新 Skill 的参数类型 |
| `SkillValidationResult` | Skill 校验结果类型（valid、name、description、metadata、error） |
| `UserSkillWithAgentCount` | Skill 详情响应类型（含关联 Agent 数量） |

## Supabase 存储集成

### skills bucket

Skill 文件存储在 Supabase Storage 的 `skills` bucket 中。

### 目录结构

```
skills/
  ├── {userId}/
  │   ├── {skillName}/
  │   │   ├── SKILL.md        # 必需的 Skill 主文件
  │   │   ├── scripts/        # 可选的脚本文件
  │   │   │   └── run.sh
  │   │   └── templates/      # 可选的模板文件
  │   │       └── template.md
  │   └── another-skill/
  │       └── SKILL.md
  └── ...
```

### 文件哈希计算

使用 SHA256 哈希进行版本检测：

```typescript
// 计算目录整体哈希
export async function calculateDirectoryHash(
  files: Array<{ path: string; content: string }>
): Promise<string> {
  // 按路径排序文件，确保哈希稳定
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // 计算每个文件的哈希并拼接
  const fileHashes: string[] = [];
  for (const file of sortedFiles) {
    const hash = await calculateFileHash(file.content);
    fileHashes.push(`${file.path}:${hash}`);
  }

  // 计算整体哈希
  const combinedContent = fileHashes.join("\n");
  return calculateFileHash(combinedContent);
}
```

### listAllFiles - 递归列出目录文件

Supabase Storage 不支持直接列出目录下的所有文件，需要递归遍历：

```typescript
/**
 * 列出目录下所有文件（递归）
 * @param supabase Supabase 客户端
 * @param prefix 目录路径前缀
 * @returns 文件完整路径列表
 */
async function listAllFiles(supabase: any, prefix: string): Promise<string[]> {
  const allFiles: string[] = [];

  // 递归列出文件的辅助函数
  async function listRecursive(currentPath: string): Promise<void> {
    // 列出当前目录下的文件和子目录
    const { data, error } = await supabase.storage
      .from(SKILLS_BUCKET)
      .list(currentPath);

    if (error || !data || data.length === 0) {
      return;
    }

    // 遍历每个项目
    for (const item of data) {
      const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;

      // 如果是目录（没有扩展名且 metadata 为 null），递归处理
      if (!item.name.includes(".") && item.metadata === null) {
        await listRecursive(fullPath);
      } else {
        // 是文件，添加到列表
        allFiles.push(fullPath);
      }
    }
  }

  // 从指定前缀开始递归
  await listRecursive(prefix);
  return allFiles;
}
```

该函数用于下载 Skill 目录时获取所有文件路径，支持多层子目录结构。

### 存储路径格式

- 路径格式：`skills/{userId}/{skillName}/{relativePath}`
- 示例：`skills/user123/my-skill/SKILL.md`

## 后端实现

### Skill API（CRUD）

#### 1. 创建 Skill - POST /api/skills

```typescript
// 解析 FormData 格式的目录上传
const formData = await request.formData();
const files = formData.getAll("files") as File[];
const pathsJson = formData.get("paths") as string;

// 构建文件映射（相对路径 -> 内容）
const fileMap = new Map<string, string>();
for (let i = 0; i < files.length; i++) {
  const content = await files[i].text();
  const normalizedPath = paths[i].split('/').slice(1).join('/');
  fileMap.set(normalizedPath, content);
}

// 校验 Skill 目录
const validation = validateSkillDirectory(fileMap);
if (!validation.valid) {
  return errorResponse("UNPROCESSABLE_ENTITY", validation.error, 422);
}

// 上传目录到 Supabase Storage
const uploadResult = await uploadSkillDirectory(userId, validation.name!, validation.files!);

// 创建 Skill 记录
const skill = await createUserSkill({
  id: validation.name!,  // 使用 name 作为 ID
  userId,
  name: validation.name!,
  description: validation.description!,
  metadata: validation.metadata,
  storagePath: `skills/${userId}/${validation.name!}`,
  fileHash: await calculateDirectoryHash(validation.files!),
  fileSize: validation.totalSize,
  fileCount: validation.files!.length,
});
```

#### 2. 获取 Skill 列表 - GET /api/skills

返回用户的所有 Skill，含关联 Agent 数量：

```typescript
const skills = await getUserSkillsByUserId(userId);

return NextResponse.json({
  skills: skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    agentCount: skill.agentCount,
    fileCount: skill.file_count ?? 1,
    totalSize: skill.file_size ?? 0,
    createdAt: skill.created_at,
    updatedAt: skill.updated_at,
  })),
});
```

#### 3. 获取 Skill 详情 - GET /api/skills/[id]

包含文件列表内容：

```typescript
const skill = await getUserSkillById(id);
const agentIds = await getSkillAgents(id);

// 下载 Skill 目录内容
let files: Array<{ path: string; content: string }> = [];
if (skill.storage_path) {
  const downloadResult = await downloadSkillDirectory(skill.user_id, skill.name);
  if (downloadResult.success && downloadResult.files) {
    files = downloadResult.files;
  }
}
```

#### 4. 删除 Skill - DELETE /api/skills/[id]

需先解除 Agent 关联：

```typescript
// 检查关联 Agent 数量
const agentIds = await getSkillAgents(id);
if (agentIds.length > 0) {
  return errorResponse("VALIDATION_ERROR",
    `该 Skill 已关联 ${agentIds.length} 个 Agent，请先移除关联后再删除`, 400);
}

// 删除 Supabase Storage 中的文件
await deleteSkillDirectory(userId, id);

// 删除数据库记录
await deleteUserSkill(userId, id);
```

### 文件校验（lib/infra/skills/validator.ts）

`validator.ts` 负责 Skill 目录和文件的格式校验，包含以下核心功能：

- **`validateSkillFile`**：校验单个 SKILL.md 文件内容（frontmatter 格式、name/description 字段）
- **`validateSkillDirectory`**：校验整个 Skill 目录（是否包含 SKILL.md、总大小限制等）
- **`extractSkillMetadata`**：从 SKILL.md 提取 YAML frontmatter 元数据
- **`extractSkillBody`**：从 SKILL.md 提取正文内容（剥离 frontmatter）

Skill 目录必须满足以下约束：

```typescript
const SKILL_CONSTRAINTS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MIN_LENGTH: 1,
  DESCRIPTION_MAX_LENGTH: 200,
  MAX_FILE_SIZE: 5 * 1024 * 1024,    // 单文件限制 5MB
  MAX_TOTAL_SIZE: 5 * 1024 * 1024,   // 目录总大小限制 5MB
};

// 校验目录结构
export function validateSkillDirectory(files: Map<string, string>): SkillDirectoryValidation {
  // 1. 检查根目录是否有 SKILL.md 文件
  if (!files.has("SKILL.md")) {
    return { valid: false, error: "目录缺少 SKILL.md 文件" };
  }

  // 2. 使用 gray-matter 解析 frontmatter
  const parsed = matter(skillMdContent);

  // 3. 校验 name 和 description 字段
  // 4. 计算目录总大小
  // 5. 返回校验结果
}
```

### Skill 发现（lib/infra/skills/discovery.ts）

`discovery.ts` 负责**本地开发场景下 Skill 目录的自动扫描与发现**（使用 Node.js `fs` 模块读取本地文件系统，仅适用于本地开发环境），与 `validator.ts` 的区别：

| 对比维度 | validator.ts | discovery.ts |
|----------|-----------------|--------------|
| 功能定位 | 校验用户上传的 Skill 目录格式 | 扫描本地 Skill 目录，发现可用 Skill |
| 输入来源 | 用户上传的文件映射（`Map<string, string>`） | 本地文件系统路径 |
| 输出结果 | 校验结果（valid/error） | Skill 元数据列表（`SkillMeta[]`） |
| 使用场景 | API 上传时的格式校验 | 服务启动或按需发现 Skill |

核心函数：

```typescript
// 扫描 Skill 目录，发现所有可用的 Skill
export async function discoverSkills(skillsDir: string): Promise<SkillMeta[]> {
  // 1. 检查目录是否存在
  // 2. 遍历子目录，检查是否有 index.ts/index.js
  // 3. 解析 README.md 或 index.ts 中的 frontmatter
  // 4. 校验元数据完整性（name + description）
  // 5. 返回 Skill 元数据列表
}

// 验证 Skill 元数据是否完整
export function validateSkillMetadata(metadata: Partial<SkillMetadata>): {
  valid: boolean;
  errors: string[];
}
```

### Skill 注册与执行（lib/infra/skills/loader.ts）

`loader.ts` 提供**内存注册表管理**，与 `lib/infra/sandbox/skill-loader.ts` 的区别：

| 对比维度 | lib/infra/sandbox/skill-loader.ts | lib/infra/skills/loader.ts |
|----------|------------------------|---------------------|
| 功能定位 | 将 Skill 文件下载到沙盒工作区 | 管理 Skill 的注册、查找、执行（内存层） |
| 存储位置 | 文件系统（沙盒工作区） | 内存注册表（`Map<string, SkillDefinition>`） |
| 使用场景 | 对话开始时加载 Skill 文件到沙盒 | 程序运行时动态注册和调用 Skill |
| 关联阶段 | 对话运行时 | 应用层抽象 |

核心函数：

```typescript
// Skill 注册表（内存缓存）
const skillRegistry = new Map<string, SkillDefinition>();

// 注册 Skill
export function registerSkill(skillId: string, definition: SkillDefinition): void;

// 加载单个 Skill（从注册表获取）
export function loadSkill(skillId: string): SkillDefinition | undefined;

// 批量加载 Skills
export function loadSkills(skillIds: string[]): SkillDefinition[];

// 执行 Skill
export async function executeSkill<TInput, TOutput>(
  skillId: string, input: TInput, context: SkillContext
): Promise<SkillResult<TOutput>>;

// 获取已注册 Skill 列表
export function getRegisteredSkills(): SkillMeta[];

// 清除注册表（用于测试）
export function clearSkillRegistry(): void;
```

### Skill 类型定义

Skill 模块的类型定义分为两个文件：

#### lib/infra/skills/core-types.ts — 核心类型

定义 Skill 模块的基础类型，供各模块共同使用：

| 类型 | 说明 |
|------|------|
| `SkillMetadata` | Skill 元数据接口（name、description、version、author、permissions、dependencies） |
| `SkillContext` | Skill 执行上下文（userId、agentId、conversationId、workingDirectory） |
| `SkillResult<T>` | Skill 执行结果（success、data、error、logs） |
| `SkillFunction<TInput, TOutput>` | Skill 函数类型定义 |
| `SkillDefinition<TInput, TOutput>` | Skill 定义接口（metadata + inputSchema + execute） |
| `SkillMeta` | 轻量级元数据（用于发现，含 id、name、description、filePath） |

#### lib/infra/skills/types.ts — 工具模块类型

定义 Skill 工具化相关的类型，为 `skill-tool.ts` 和 `skill-service.ts` 提供支持：

| 类型 | 说明 |
|------|------|
| `SkillToolInput` | Skill 工具输入参数（skillId + JSON 格式 input） |
| `SkillExecutionContext` | Skill 执行上下文（扩展版，增加 sessionId 和 metadata） |
| `SkillToolResult` | Skill 工具返回格式（success、data、error、errorType、logs） |
| `SkillErrorType` | Skill 错误类型枚举（SKILL_NOT_FOUND、SKILL_EXECUTE_ERROR、INVALID_INPUT 等） |
| `SkillToolDefinition` | Skill 工具定义接口（用于注册到 ToolRegistry） |
| `SkillLoadResult` | Skill 加载结果（success、loadedSkillIds、failedSkills、toolDefinitions） |

### 辅助函数

#### extractSkillMetadata - 提取元数据

```typescript
/**
 * 从 Skill 内容提取元数据
 * @param content Skill 文件内容
 * @returns 元数据对象
 */
export function extractSkillMetadata(content: string): Record<string, unknown> | null {
  try {
    const parsed = matter(content);
    return parsed.data || null;
  } catch {
    return null;
  }
}
```

用于从 SKILL.md 中提取 YAML frontmatter 的元数据部分，返回包含 name、description 等字段的 JSON 对象。

#### extractSkillBody - 提取正文内容

```typescript
/**
 * 获取 Skill 正文内容（不含 frontmatter）
 * @param content Skill 文件内容
 * @returns 正文内容
 */
export function extractSkillBody(content: string): string {
  try {
    const parsed = matter(content);
    return parsed.content.trim();
  } catch {
    return content;
  }
}
```

用于从 SKILL.md 中剥离 frontmatter，返回纯正文内容，便于展示或处理 Skill 的功能说明。

### SKILL.md 格式要求

```markdown
---
name: my-skill
description: 这是一个示例 Skill
---

# Skill 正文内容

这里是 Skill 的具体功能说明和使用方法...
```

### 版本检测

使用 `fileHash` 字段进行版本检测：

```typescript
// 计算文件哈希
export async function calculateFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

## 运行时加载

> 本节描述两个不同层次的加载机制：`lib/infra/skills/loader.ts`（内存层注册与执行）和 `lib/infra/sandbox/skill-loader.ts`（沙盒层文件下载与注入）。

#### lib/infra/skills/loader.ts — 内存层注册与执行

`loader.ts` 负责应用层的 Skill 注册与执行管理：

1. **注册**：将 Skill 定义（含元数据、输入 Schema、执行函数）注册到内存注册表
2. **查找**：按 Skill ID 从注册表获取定义
3. **执行**：调用 Skill 的 `execute` 函数，返回结构化结果（`SkillResult`）
4. **列举**：获取所有已注册 Skill 的元数据列表

```typescript
// Skill 注册表（内存缓存）
const skillRegistry = new Map<string, SkillDefinition>();

export function registerSkill(skillId: string, definition: SkillDefinition): void;
export function loadSkill(skillId: string): SkillDefinition | undefined;
export function loadSkills(skillIds: string[]): SkillDefinition[];
export async function executeSkill<TInput, TOutput>(
  skillId: string, input: TInput, context: SkillContext
): Promise<SkillResult<TOutput>>;
export function getRegisteredSkills(): SkillMeta[];
export function clearSkillRegistry(): void;
```

#### lib/infra/sandbox/skill-loader.ts — 沙盒层文件加载

##### 加载流程

```typescript
export async function loadSkillsToSandbox(
  userId: string,
  agentId: string,
  sessionId: string
): Promise<LoadSkillsResult> {
  // 1. 获取 Agent 配置的 Skills
  const skills = await getAgentSkillInfos(agentId);

  // 2. 逐个加载 Skill
  for (const skill of skills) {
    // 检查是否已是最新（沙盒中已存在）
    const isUpToDate = await isSkillUpToDate(sessionId, userId, skill.id, skill.fileHash);

    if (isUpToDate) {
      result.skippedSkills.push(skill.id);
      continue;
    }

    // 下载目录并写入沙盒
    const downloadResult = await downloadSkillDirectoryToSandbox(sessionId, userId, skill);

    if (downloadResult.success) {
      result.loadedSkills.push(skill.id);
    }
  }

  // 3. 生成预置提示词
  result.presetPrompt = generatePresetPrompt(availableSkills);

  return result;
}
```

### 沙盒目录结构

Skill 加载后的沙盒目录结构：

```
sandbox-workspace/
  ├── skills/
  │   ├── {skillId}/
  │   │   ├── SKILL.md
  │   │   ├── scripts/
  │   │   └── templates/
  │   └── another-skill-id/
  │       └── SKILL.md
  └── ...
```

### 预置提示词生成

```typescript
function generatePresetPrompt(skills: SkillLoadInfo[]): string {
  const skillList = skills
    .map((skill) =>
      `- **${skill.name}**: ${skill.description}\n  - 文件路径: \`skills/${skill.id}/SKILL.md\``
    )
    .join("\n");

  return `## 已配置的 Skills

以下 Skills 已配置到你的环境中，位于沙盒 \`skills/\` 目录下：

${skillList}

### 如何使用 Skills

1. **读取 Skill 正文**: 使用 \`readFile\` 工具读取 \`skills/{skillId}/SKILL.md\`
2. **读取 Skill 目录下的文件**: 使用 \`readFile\` 工具读取 \`skills/{skillId}/\` 下的其他文件
3. **执行 Skill 目录下的脚本**: 使用 \`bash\` 工具执行 \`skills/{skillId}/\` 下的脚本文件

在执行 Skill 相关操作前，建议先读取 Skill 正文了解其具体功能和用法。`;
}
```

### 强制系统工具

配置 Skill 时，Agent 会自动启用必要的系统工具：

```typescript
// 如果配置了 Skill，强制包含必要的系统工具
if (skillIds && skillIds.length > 0) {
  const requiredTools: SystemToolId[] = [
    'system:sandbox:bash',
    'system:sandbox:readFile',
    'system:sandbox:writeFile',
  ];
  enabledSystemTools = [...new Set([...enabledSystemTools, ...requiredTools])];
}
```

## Skill 工具实现

> 本节描述 `lib/infra/skills/skill-tool.ts`，负责将 Skill 注册为 Agent 可用的 Tool。

### 设计目标

- 提供统一的 `execute_skill` 工具接口
- 支持为每个 Skill 创建专属工具定义
- 支持从 `SkillDefinition` 直接创建工具
- 提供完善的错误处理机制（统一的 `SkillErrorType` 枚举）

### 核心函数

```typescript
// execute_skill 工具参数 Schema（基于 zod）
export const executeSkillSchema = z.object({
  skillId: z.string().describe('要执行的 Skill ID'),
  input: z.string().describe('JSON 字符串形式的 Skill 输入参数'),
});

// 创建通用的 execute_skill 工具定义
export function createSkillToolDefinition(
  context: SkillExecutionContext
): ToolDefinition;

// 创建指定 Skill 的专属工具定义（注册为 skill_{skillId}）
export function createSpecificSkillToolDefinition(
  skillId: string,
  context: SkillExecutionContext
): ToolDefinition | null;

// 批量创建 Skill 工具定义（通用 + 专属）
export function createSkillToolDefinitions(
  skillIds: string[],
  context: SkillExecutionContext
): ToolDefinition[];

// 从 SkillDefinition 直接创建工具定义
export function createToolFromSkillDefinition(
  skillDef: SkillDefinition,
  context: SkillExecutionContext
): ToolDefinition;
```

### 错误类型

Skill 工具使用统一的错误类型枚举：

| 错误类型 | 说明 |
|----------|------|
| `SKILL_NOT_FOUND` | Skill 未找到 |
| `SKILL_EXECUTE_ERROR` | Skill 执行错误 |
| `INVALID_INPUT` | 输入参数无效（JSON 解析失败） |
| `SKILL_NOT_REGISTERED` | Skill 未注册 |
| `CONTEXT_MISSING` | 上下文缺失 |

### 工具注册流程

1. **通用工具**：创建 `execute_skill` 工具，接受 `skillId` 和 `input` 参数，可执行任意已注册的 Skill
2. **专属工具**：为每个 Skill 创建 `skill_{skillId}` 工具，仅需 `input` 参数，直接调用对应 Skill
3. **注册到 ToolRegistry**：通过 `registerTool` 将工具定义注册，供 Agent 运行时使用

## Skill 加载服务

> 本节描述 `lib/infra/skills/skill-service.ts`，负责从数据库加载 Agent 配置的 Skills 并注册到 ToolRegistry。

### 设计目标

- 从数据库获取 Agent 的 Skill 配置
- 将 Skills 转换为工具定义并注册到 ToolRegistry
- 提供批量加载和注册能力
- 提供 Skill 元数据查询接口

### 核心函数

#### 数据查询

```typescript
// 从数据库获取 Agent 的 Skills 信息
export async function getAgentSkillDataInfos(
  agentId: string
): Promise<SkillDataInfo[]>;

// 批量获取多个 Agent 的 Skills 信息
export async function getAgentsSkillDataInfosBatch(
  agentIds: string[]
): Promise<Map<string, SkillDataInfo[]>>;
```

#### Skill 加载与注册

```typescript
// Skill 加载选项
export interface SkillLoadOptions {
  agentId: string;
  userId: string;
  conversationId?: string;
  workingDirectory?: string;
  registerSpecificTools?: boolean;  // 是否注册专属工具（默认 true）
}

// 加载 Agent 的 Skills 并注册到 ToolRegistry
// 流程：数据库查询 → 构建上下文 → 创建工具定义 → 注册到 ToolRegistry
export async function loadAgentSkills(
  options: SkillLoadOptions
): Promise<SkillLoadResult>;

// 批量加载多个 Agent 的 Skills
export async function loadAgentsSkillsBatch(
  agentIds: string[],
  userId: string
): Promise<Map<string, SkillLoadResult>>;
```

#### 工具实例创建

```typescript
// 创建 Agent 的 Skill 工具实例（用于 Agent 运行时）
export async function createAgentSkillTools(
  agentId: string,
  userId: string,
  conversationId?: string
): Promise<ToolCreateResult>;
```

#### Skill 定义管理

```typescript
// 注册 Skill 定义到 SkillRegistry
export function registerSkillDefinition(
  skillId: string,
  definition: SkillDefinition
): void;

// 批量注册 Skill 定义
export function registerSkillDefinitions(
  skills: Map<string, SkillDefinition>
): void;

// 清理 Skill 相关资源
export function cleanupSkills(): void;
```

#### 元数据查询

```typescript
// 获取已注册的 Skill 元数据列表
export function getRegisteredSkillMetas(): SkillMeta[];

// 检查 Skill 是否已注册
export function isSkillRegistered(skillId: string): boolean;

// 获取 Skill 定义
export function getSkillDefinition(skillId: string): SkillDefinition | null;
```

### 加载流程

```
┌─────────────────────────────────────────────────────────────┐
│                Skill 加载服务流程                              │
└─────────────────────────────────────────────────────────────┘

  1. loadAgentSkills(options)
         │
         ▼
  2. getAgentSkillDataInfos(agentId)
     └── 动态导入 lib/db/agents → getAgentSkillsInfo(agentId)
         │
         ▼
  3. 构建 SkillExecutionContext
     └── userId, agentId, conversationId, workingDirectory
         │
         ▼
  4. createSkillToolDefinition(context)
     └── 注册通用 execute_skill 工具到 ToolRegistry
         │
         ▼
  5. 遍历每个 Skill：
     ├── createSpecificSkillToolDefinition(skillId, context)
     │   └── 注册专属 skill_{skillId} 工具到 ToolRegistry
     └── 记录加载结果（成功/失败）
         │
         ▼
  6. 返回 SkillLoadResult
     └── success, loadedSkillIds, failedSkills, toolDefinitions
```

## 前端实现

### skill-upload-dialog.tsx

上传对话框，支持目录选择：

```typescript
// 使用 webkitdirectory 属性支持目录选择
<input
  type="file"
  webkitdirectory=""
  onChange={handleDirectorySelect}
/>

// 处理目录选择
const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const fileArray = Array.from(selectedFiles);
  const paths = fileArray.map(f => f.webkitRelativePath);

  // 检查是否包含 SKILL.md 文件
  const hasSkillMd = paths.some(p => p.endsWith('SKILL.md'));
  if (!hasSkillMd) {
    setError('Skill 目录必须包含 SKILL.md 文件');
    return;
  }
};
```

### skill-selector.tsx

选择器组件，用于 Agent 表单：

```typescript
interface SkillSelectorProps {
  selectedSkillIds: string[];
  onChange: (skillIds: string[]) => void;
  onSkillsLoaded?: (skills: Skill[]) => void;
}

// 加载用户的 Skill 列表
useEffect(() => {
  const response = await authenticatedFetch("/api/skills");
  const data = await response.json();
  setSkills(data.skills || []);
}, []);
```

### skill-preset-preview.tsx

预置提示词预览组件：

- 选择 Skill 后实时展示预置提示词
- 让用户了解对话时注入的内容
- 可展开/折叠

### settings/skills/page.tsx

Skill 管理页面：

- Skill 列表展示（网格布局）
- 上传按钮（打开上传对话框）
- 删除功能（需确认）

## 使用指南

### 上传 Skill

1. 准备 Skill 目录，确保包含 `SKILL.md` 文件
2. 访问 `/settings/skills` 页面
3. 点击"上传 Skill"按钮
4. 选择 Skill 目录（浏览器支持目录选择）
5. 等待上传完成

### 关联到 Agent

1. 在 Agent 编辑页面找到"关联 Skill"区域
2. 从 Skill 选择器勾选需要的 Skill
3. 保存 Agent 配置
4. 预置提示词预览区域会自动显示注入内容

### 在对话中使用

1. 选择配置了 Skill 的 Agent 开始对话
2. Skill 文件自动加载到沙盒 `skills/` 目录
3. 预置提示词注入到系统消息中
4. AI 可以读取、执行 Skill 目录中的文件

## 注意事项

### 文件格式要求

1. **SKILL.md 必需**：Skill 目录必须包含 `SKILL.md` 文件
2. **frontmatter 格式**：SKILL.md 必须包含有效的 YAML frontmatter
3. **name 字段**：长度限制 1-50 字符
4. **description 字段**：长度限制 1-200 字符
5. **目录大小**：总大小不超过 5MB

### 删除前需解除关联

- Skill 关联 Agent 后无法直接删除
- 需先在 Agent 编辑页面移除关联
- 删除时会检查关联数量

### 版本管理

- `fileHash` 用于版本检测
- 更新 Skill 会重新计算哈希
- 沙盒中已存在的 Skill 会跳过下载（优化性能）

### 命名唯一性

- 同一用户下 Skill 名称唯一
- 使用名称作为 ID
- 上传时检查名称是否重复

### skills-lock.json 已删除

- `skills-lock.json` 文件已被删除，不再用于锁定 Skill 版本
- Skill 的版本管理现在通过数据库 `file_hash` 字段实现
- 如发现残留的 `skills-lock.json` 文件，可安全删除

## 相关文件清单

| 文件路径 | 功能说明 |
|----------|----------|
| `lib/infra/skills/core-types.ts` | Skill 核心类型定义（SkillMetadata, SkillContext, SkillResult, SkillDefinition, SkillMeta） |
| `lib/infra/skills/types.ts` | Skill 工具模块类型定义（SkillToolInput, SkillExecutionContext, SkillToolResult, SkillErrorType, SkillToolDefinition, SkillLoadResult） |
| `lib/infra/skills/discovery.ts` | Skill 发现模块（仅本地开发），扫描本地 Skill 目录并解析 frontmatter 元数据 |
| `lib/infra/skills/loader.ts` | Skill 注册与执行模块，内存注册表管理、按需加载和执行 |
| `lib/infra/skills/validator.ts` | Skill 文件和目录校验工具（frontmatter 解析、格式校验、元数据提取） |
| `lib/infra/skills/skill-tool.ts` | Skill 工具实现，将 Skill 注册为 Agent 可用的 Tool（execute_skill、专属工具） |
| `lib/infra/skills/skill-service.ts` | Skill 加载服务，从数据库加载 Agent 配置的 Skills 并注册到 ToolRegistry |
| `lib/infra/skills/index.ts` | Skills 模块统一导出（类型、发现、加载、工具、服务） |
| `lib/db/skills.ts` | Skill 数据访问层，CRUD 操作和关联管理 |
| `lib/schemas/tool.ts` | Skill 数据库表结构定义和类型声明（UserSkill, AgentSkill, SkillValidationResult 等） |
| `lib/schemas/index.ts` | Schemas 模块统一导出 |
| `lib/infra/sandbox/skill-loader.ts` | Skill 运行时加载到沙盒（文件下载与注入） |
| `lib/infra/sandbox/index.ts` | Sandbox 模块统一导出 |
| `lib/infra/supabase/storage.ts` | Supabase Storage 文件上传下载 |
| `lib/infra/supabase/client.ts` | Supabase 客户端配置 |
| `lib/infra/supabase/index.ts` | Supabase 模块统一导出 |
| `app/api/skills/route.ts` | Skill 列表和创建 API |
| `app/api/skills/[id]/route.ts` | Skill 详情、更新、删除 API |
| `app/api/v1/skills/route.ts` | 对外 Skill 列表 API（API Key 鉴权） |
| `app/api/v1/skills/[id]/route.ts` | 对外 Skill 更新 API |
| `lib/db/agents.ts` | Agent 数据访问层，含 Skill 关联函数 |
| `components/settings/skill-upload-dialog.tsx` | Skill 上传对话框 |
| `components/settings/skill-selector.tsx` | Skill 选择器（Agent 表单） |
| `components/settings/skill-preset-preview.tsx` | 预置提示词预览组件 |
| `app/settings/skills/page.tsx` | Skill 管理页面 |

---

**创建时间**：2026-03-31

**最后更新**：2026-04-30

**修订记录**：
- v1.1 (2026-03-31): 修复预置提示词中文件路径（skill.md → SKILL.md），补充 extractSkillMetadata、extractSkillBody、listAllFiles 辅助函数说明
- v1.2 (2026-04-22): 新增 lib/skills/ 模块说明（discovery.ts、loader.ts、types.ts、index.ts）；更新数据库设计章节，schema 路径从 lib/db/schema.ts 迁移至 lib/schemas/tool.ts；补充 Skill 发现与注册执行流程；补充 Skill 相关类型定义表；说明 skills-lock.json 已删除
- v1.3 (2026-04-30): Skill 模块从 lib/skills/ 和 lib/utils/ 整体迁移至 lib/infra/skills/；新增 skill-service.ts（Skill 加载服务）和 skill-tool.ts（Skill 工具实现）章节；types 拆分为 core-types.ts（核心类型）和 types.ts（工具模块类型）；validator.ts 替代原 lib/utils/skill-validator.ts；更新所有路径引用
- v1.4 (2026-05-01): 修正路径错误（sandbox/ → lib/infra/sandbox/，lib/supabase/ → lib/infra/supabase/）；删除不存在的文件条目（lib/db/schema.ts、skill-detail-dialog.tsx、skill-card.tsx）；补充缺失文件（lib/infra/supabase/index.ts、lib/infra/sandbox/index.ts、lib/schemas/index.ts）；修复重复标题；明确 discovery.ts 仅用于本地开发场景
