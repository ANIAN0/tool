# API Keys 管理说明

> **文档目的:** 记录 API Keys 管理功能的完整实现，用于外部程序调用认证，便于后续开发维护和扩展。

**系统概述:** API Key 是用户创建的访问密钥，用于外部程序调用系统接口。与 JWT 认证不同，JWT 用于前端用户会话认证（短期有效、自动刷新），而 API Key 用于机器/程序调用（长期有效、手动管理）。

**技术栈:** Next.js 15 + React 19 + Turso SQLite + SHA256 哈希

---

## 目录

1. [系统架构](#1-系统架构)
2. [数据库设计](#2-数据库设计)
3. [后端实现](#3-后端实现)
4. [前端实现](#4-前端实现)
5. [使用指南](#5-使用指南)
6. [注意事项](#6-注意事项)

---

## 1. 系统架构

### 1.1 API Key 与 JWT 认证对比

| 特性 | JWT 认证 | API Key 认证 |
|------|----------|--------------|
| 适用场景 | 前端用户会话 | 外部程序/机器调用 |
| 有效期 | 访问令牌15分钟，刷新令牌7天 | 长期有效（用户手动管理） |
| 存储方式 | Token 明文（前端 localStorage） | SHA256 哈希（数据库） |
| 传输方式 | Authorization: Bearer {token} | Authorization: Bearer {apiKey} |
| 刷新机制 | 自动刷新（refresh token） | 无自动刷新，手动轮换 |
| 撤销方式 | 登出清除 | 删除 Key 记录 |

### 1.2 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| API Key 数据层 | `lib/db/api-keys.ts` | Key 生成、哈希计算、CRUD 操作 |
| API Key 列表 API | `app/api/api-keys/route.ts` | 列表获取、创建 |
| API Key 单个 API | `app/api/api-keys/[id]/route.ts` | 删除操作 |
| 管理页面 | `app/settings/api-keys/page.tsx` | 前端管理界面 |
| 认证中间件 | `lib/infra/user/middleware.ts` | API Key 验证（预留） |

### 1.3 流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      创建 API Key 流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户输入名称                                                 │
│       │                                                     │
│       ▼                                                     │
│  generateApiKey() ──▶ sk_live_xxxxxxxx... (32位随机)         │
│       │                                                     │
│       ▼                                                     │
│  hashApiKey() ──▶ SHA256 哈希                                │
│       │                                                     │
│       ▼                                                     │
│  存储到数据库：key_hash + key_prefix                          │
│       │                                                     │
│       ▼                                                     │
│  返回完整 Key（仅此一次可见）                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      验证 API Key 流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  外部程序发送 Authorization: Bearer sk_live_xxx              │
│       │                                                     │
│       ▼                                                     │
│  计算 Key 的 SHA256 哈希                                      │
│       │                                                     │
│       ▼                                                     │
│  查询数据库 key_hash 字段                                     │
│       │                                                     │
│       ▼                                                     │
│  匹配成功 ──▶ 返回 userId + 更新 last_used_at                  │
│  匹配失败 ──▶ 返回 null                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 数据库设计

### 2.1 user_api_keys 表结构

```sql
CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY,              -- API Key ID (nanoid生成)
  user_id TEXT NOT NULL,            -- 所属用户ID
  name TEXT NOT NULL,               -- Key 名称（便于用户识别）
  key_hash TEXT NOT NULL,           -- API Key 的 SHA256 哈希（不可逆）
  key_prefix TEXT NOT NULL,         -- Key 前缀（用于展示，如 sk_live_xxx）
  last_used_at INTEGER,             -- 最后使用时间戳
  created_at INTEGER NOT NULL,      -- 创建时间戳
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2.2 索引设计

```sql
-- 按用户 ID 查询 API Key（列表展示）
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- 按 Key 哈希快速查找（鉴权验证时使用）
CREATE INDEX IF NOT EXISTS idx_user_api_keys_key_hash ON user_api_keys(key_hash);
```

### 2.3 类型定义

**文件:** `lib/schemas/api-key.ts`

```typescript
// 完整 API Key 记录（内部使用）
export interface UserApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;        // SHA256 哈希
  key_prefix: string;      // 展示前缀
  last_used_at: number | null;
  created_at: number;
}

// 创建 API Key 参数
export interface CreateUserApiKeyParams {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
}

// API Key 列表项（不含敏感信息）
export interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;       // 仅展示前缀
  lastUsedAt: number | null;
  createdAt: number;
}
```


---

## 3. 后端实现

### 3.1 API Key 生成算法

**文件:** `lib/db/api-keys.ts`

```typescript
// API Key 格式配置
const API_KEY_PREFIX = "sk_live_";      // 生产环境前缀
const API_KEY_RANDOM_LENGTH = 32;       // 随机部分长度

/**
 * 生成 API Key
 * 格式: sk_live_{32位随机字符串}
 * 字符集: a-z, A-Z, 0-9
 * @returns 完整的 API Key（仅创建时可见）
 */
export function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomStr = "";
  for (let i = 0; i < API_KEY_RANDOM_LENGTH; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${API_KEY_PREFIX}${randomStr}`;
}
```

**生成示例:**
```
sk_live_aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV
```

### 3.2 SHA256 哈希存储

```typescript
/**
 * 计算 API Key 的 SHA256 哈希
 * 使用 Web Crypto API，兼容浏览器和 Node.js
 * @param apiKey 完整的 API Key
 * @returns 64位十六进制哈希字符串
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

**哈希示例:**
```
输入: sk_live_xxxxxxxx...
输出: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

### 3.3 前缀提取（展示用）

```typescript
/**
 * 提取 API Key 的前缀（用于展示）
 * 格式: sk_live_xxxxxxxx...
 * @param apiKey 完整的 API Key
 * @returns 前缀 + 前8位随机字符 + "..."
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, API_KEY_PREFIX.length + 8) + "...";
}
```

**前缀示例:**
```
完整Key: sk_live_xxxxxxxx...
展示前缀: sk_live_aB3cD4eF...
```

### 3.4 CRUD 操作

**创建 API Key:**

```typescript
/**
 * 创建新的 API Key
 * @param params 创建参数（不含 keyHash 和 keyPrefix）
 * @param apiKey 完整的 API Key（用于计算哈希）
 */
export async function createUserApiKey(
  params: Omit<CreateUserApiKeyParams, "keyHash" | "keyPrefix">,
  apiKey: string
): Promise<UserApiKey>
```

**获取列表:**

```typescript
/**
 * 获取用户的所有 API Key（列表形式，不含敏感信息）
 * 按 created_at DESC 排序
 */
export async function getUserApiKeysByUserId(userId: string): Promise<ApiKeyListItem[]>
```

**单个查询:**

```typescript
/**
 * 根据 ID 获取 API Key 详情（验证所有权）
 */
export async function getUserApiKeyById(userId: string, apiKeyId: string): Promise<UserApiKey | null>
```

**删除:**

```typescript
/**
 * 删除 API Key（验证用户所有权）
 */
export async function deleteUserApiKey(userId: string, apiKeyId: string): Promise<boolean>
```

### 3.5 验证流程

```typescript
/**
 * 通过 API Key 哈希验证并获取用户 ID
 * 同时更新 last_used_at 时间戳
 * @param keyHash API Key 的 SHA256 哈希
 * @returns 匹配的用户 ID，不匹配返回 null
 */
export async function validateApiKey(keyHash: string): Promise<string | null>
```

**验证逻辑:**
1. 通过 `key_hash` 索引快速查询
2. 匹配成功返回 `user_id`
3. 更新 `last_used_at` 为当前时间
4. 匹配失败返回 `null`

### 3.6 API 端点

**文件:** `app/api/api-keys/route.ts`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/api-keys` | 获取 API Key 列表 |
| POST | `/api/api-keys` | 创建新 API Key |

**GET 响应示例:**

```json
{
  "apiKeys": [
    {
      "id": "abc123",
      "name": "生产环境 Key",
      "keyPrefix": "sk_live_aB3cD4eF...",
      "lastUsedAt": 1712131200000,
      "createdAt": 1711231200000
    }
  ]
}
```

**POST 请求:**

```typescript
POST /api/api-keys
{
  name: string;   // Key 名称，必填
}

// 响应（仅创建时返回完整 Key）
{
  success: true;
  data: {
    id: string;
    name: string;
    key: string;      // 完整 Key，仅此一次可见
    warning: string;  // 提示用户保存
  }
}
```

**文件:** `app/api/api-keys/[id]/route.ts`

| 方法 | 路径 | 功能 |
|------|------|------|
| DELETE | `/api/api-keys/[id]` | 删除指定 API Key |

---

## 4. 前端实现

### 4.1 管理页面

**文件:** `app/settings/api-keys/page.tsx`

**页面功能:**
- API Key 列表展示（名称、前缀、最后使用时间）
- 创建新 API Key（弹出对话框）
- 删除 API Key（确认后执行）

**界面组件:**

```typescript
// API Key 列表项
<Card key={apiKey.id}>
  <CardHeader>
    <CardTitle>{apiKey.name}</CardTitle>
    <CardDescription className="font-mono">{apiKey.keyPrefix}</CardDescription>
  </CardHeader>
  <CardContent>
    <p>最后使用: {formatDate(apiKey.lastUsedAt)}</p>
  </CardContent>
</Card>
```

### 4.2 创建流程

1. 点击"创建 API Key"按钮，打开对话框
2. 输入 Key 名称（如"生产环境 Key"）
3. 点击创建，调用 `POST /api/api-keys`
4. 成功后显示完整 Key（仅此一次）
5. 提供复制按钮，用户保存后关闭

**创建对话框:**

```typescript
{createdKey ? (
  // 显示完整 Key，提示保存
  <div className="p-4 bg-muted rounded-lg">
    <code className="block p-2 bg-background rounded">{createdKey}</code>
  </div>
  <p className="text-destructive">⚠️ 此 Key 仅显示一次，请妥善保存</p>
) : (
  // 输入名称表单
  <Input placeholder="例如：生产环境 Key" />
)}
```

### 4.3 认证请求

使用 `authenticatedFetch` 工具发送请求，自动携带 JWT Token:

```typescript
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

// 获取列表
const response = await authenticatedFetch("/api/api-keys");

// 创建
const response = await authenticatedFetch("/api/api-keys", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: newKeyName.trim() }),
});

// 删除
const response = await authenticatedFetch(`/api/api-keys/${keyId}`, {
  method: "DELETE",
});
```

---

## 5. 使用指南

### 5.1 创建 API Key

1. 登录系统，进入 **设置 → API Keys** 页面
2. 点击"创建 API Key"按钮
3. 输入 Key 名称（便于识别用途）
4. 点击创建，**立即复制并保存完整 Key**
5. 关闭对话框后，Key 将无法再次查看

### 5.2 使用 API Key 调用接口

**请求格式:**

```bash
curl -X POST https://your-domain/api/endpoint \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"data": "example"}'
```

**验证流程:**

```typescript
// 服务端验证（示例）
import { hashApiKey, validateApiKey } from "@/lib/db/api-keys";

// 1. 从请求头提取 Key
const authHeader = request.headers.get("Authorization");
const apiKey = authHeader?.replace("Bearer ", "");

// 2. 计算哈希
const keyHash = await hashApiKey(apiKey);

// 3. 验证并获取用户 ID
const userId = await validateApiKey(keyHash);
if (!userId) {
  return NextResponse.json({ error: "无效的 API Key" }, { status: 401 });
}

// 4. 执行业务逻辑
// userId 已验证，可继续处理请求
```

### 5.3 管理 API Key

**查看列表:**
- 进入设置页面查看所有 Key
- 显示名称、前缀、最后使用时间

**删除 Key:**
- 点击删除按钮，确认后执行
- 删除后该 Key 立即失效

---

## 6. 注意事项

### 6.1 安全注意事项

1. **仅创建时可见**: 完整 Key 仅在创建时显示一次，关闭对话框后无法再次查看
2. **哈希存储**: 数据库仅存储 SHA256 哈希，无法反向还原原始 Key
3. **前缀展示**: 列表仅显示 Key 前缀（如 `sk_live_aB3cD4eF...`），用于识别但不泄露完整内容
4. **定期轮换**: 建议定期创建新 Key 并删除旧 Key，降低泄露风险
5. **权限限制**: 仅注册用户可创建 API Key，匿名用户不可使用

### 6.2 开发注意事项

1. **创建限制**: 创建时验证用户是否为注册用户（`isRegisteredUser`）
2. **所有权验证**: 删除时验证 Key 属于当前用户
3. **使用追踪**: 每次验证成功自动更新 `last_used_at` 时间戳
4. **级联删除**: 用户删除时，其 API Key 自动删除（`ON DELETE CASCADE`）

### 6.3 删除前检查

删除 API Key 前，建议检查:
- 是否有外部程序正在使用该 Key
- 是否已创建替代 Key
- 删除后可能影响的调用方

### 6.4 Key 格式说明

| 前缀 | 用途 |
|------|------|
| `sk_live_` | 生产环境 Key |

未来可扩展:
- `sk_test_` - 测试环境 Key
- `pk_live_` - 公开 Key（只读权限）

---

## 7. 相关文件清单

| 文件路径 | 说明 |
|----------|------|
| `lib/schemas/api-key.ts` | API Key 表结构定义、类型定义（主定义文件） |
| `lib/schemas/index.ts` | Schema 统一导出入口 |
| `lib/db/api-keys.ts` | API Key 数据访问层（生成、哈希、CRUD） |
| `app/api/api-keys/route.ts` | API Key 列表与创建 API |
| `app/api/api-keys/[id]/route.ts` | API Key 删除 API |
| `app/settings/api-keys/page.tsx` | 前端管理页面 |
| `lib/infra/user/middleware.ts` | 认证中间件（`isRegisteredUser` 验证） |
| `lib/utils/authenticated-fetch.ts` | 认证请求工具 |

---

**文档创建时间:** 2026-03-31
**最后更新时间:** 2026-05-01
**修订说明:** 删除已不存在的 `lib/db/schema.ts` 文件引用（该兼容层已移除）