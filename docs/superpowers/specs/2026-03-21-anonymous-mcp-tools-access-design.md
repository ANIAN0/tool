# 匿名用户 MCP/Tools 访问支持设计文档

## 概述

允许未登录用户访问 MCP 和 Tools 功能，每个匿名用户拥有独立的配置，登录后自动迁移到注册账户。

## 问题背景

### 当前状态

1. `/api/tools` 和 `/api/mcp/*` 使用 `authenticateRequest()`，要求用户必须登录
2. 系统存在两套不一致的匿名 ID 机制：
   - `agent_anon_id` (lib/anon-id.ts)：Chat 等功能使用，**自动生成**
   - `anonymous_user_id` (use-auth.ts)：MCP/Tools 期望使用，**从未生成（死代码）**
3. 未登录用户访问 MCP/Tools 页面时显示"未提供认证令牌"错误

### 目标

- 未登录用户可以正常使用 MCP 和 Tools 功能
- 每个匿名用户有独立的配置数据
- 登录后自动迁移匿名期间的配置到注册账户

## 设计方案

### 1. 统一匿名 ID 机制

**移除死代码**：
- 删除 `use-auth.ts` 中对 `anonymous_user_id` 的读取
- 移除 `getStoredAnonymousId()` 函数

**改造 useAuth Hook**：
```typescript
// lib/hooks/use-auth.ts
import { getAnonId } from "@/lib/anon-id";

// anonymousId 改用 getAnonId()
const [anonymousId, setAnonymousId] = useState<string | null>(null);

useEffect(() => {
  setAnonymousId(getAnonId());
}, []);

// getAuthHeader() 未登录时返回匿名 ID
const getAuthHeader = useCallback((): Record<string, string> => {
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  // 未登录时使用匿名 ID
  const anonId = getAnonId();
  if (anonId) {
    return { "X-Anonymous-Id": anonId };
  }
  return {};
}, [accessToken]);
```

### 2. API 认证改造

**注意**：`lib/auth/middleware.ts` 已存在 `withOptionalAuth()`（包装器模式）和 `getAuthContext()`。本方案新增 `authenticateRequestOptional()` 保持与现有 `authenticateRequest()` 一致的直接调用模式。

**增强 getAuthContext()（仅新增 Header 支持）**：

现有实现已支持 POST body 和 query params 的 `anonymousId`，本改动仅新增 `X-Anonymous-Id` Header 支持：

```typescript
// lib/auth/middleware.ts - getAuthContext() 函数
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  // 优先级1: JWT Token（已有）
  const authHeader = request.headers.get("Authorization");
  const token = extractAccessToken(authHeader);
  if (token) {
    const result = verifyAccessToken(token);
    if (result.valid && result.payload) {
      return { userId: result.payload.userId, isAuthenticated: true };
    }
  }

  // 优先级2: X-Anonymous-Id Header（新增）
  const anonIdHeader = request.headers.get("X-Anonymous-Id");
  if (anonIdHeader) {
    const user = await getOrCreateUser(anonIdHeader);
    return { userId: user.id, isAuthenticated: false };
  }

  // 优先级3-4: POST body 和 query params（已有，保持不变）
  // ...
}
```

**新增 authenticateRequestOptional()**：
```typescript
// lib/auth/middleware.ts
export async function authenticateRequestOptional(
  request: NextRequest
): Promise<AuthRequestResult> {
  const context = await getAuthContext(request);

  if (!context.userId) {
    return {
      success: false,
      error: "无法识别用户身份",
      status: 401,
    };
  }

  return {
    success: true,
    userId: context.userId,
  };
}
```

**改造 API 路由**：

将 `/api/tools/route.ts` 和 `/api/mcp/*/route.ts` 中的 `authenticateRequest()` 替换为 `authenticateRequestOptional()`。

```typescript
// app/api/tools/route.ts
const authResult = await authenticateRequestOptional(request);
if (!authResult.success) {
  return NextResponse.json({ error: authResult.error }, { status: authResult.status });
}
```

### 3. 登录时数据迁移

**迁移函数位置**：`lib/db/mcp.ts`（新建文件，专门处理 MCP 数据相关操作）

```typescript
// lib/db/mcp.ts（新建）
import { getDb } from "./client";

/**
 * 迁移 MCP 服务器数据到新用户
 * @param fromUserId - 原用户ID（匿名用户）
 * @param toUserId - 目标用户ID（注册用户）
 */
export async function migrateMcpData(fromUserId: string, toUserId: string): Promise<void> {
  const db = getDb();
  // 将匿名用户的 MCP 服务器迁移到注册账户
  await db.execute({
    sql: `UPDATE user_mcp_servers SET user_id = ? WHERE user_id = ?`,
    args: [toUserId, fromUserId],
  });
  // MCP 工具通过 server_id 关联，无需单独迁移
}
```

**注册时迁移 MCP 配置**：

```typescript
// app/api/auth/register/route.ts
import { migrateMcpData } from "@/lib/db/mcp";

// 在注册成功后调用
if (anonymousId) {
  await migrateMcpData(anonymousId, user.id);
}
```

**登录时迁移 MCP 配置**：

```typescript
// app/api/auth/login/route.ts
import { migrateMcpData } from "@/lib/db/mcp";

const anonId = body.anonymousId;
// 仅当匿名 ID 与当前用户 ID 不同时才迁移
// anonId === user.id 的情况：用户已在另一设备登录过，本地匿名 ID 已被替换为用户 ID
if (anonId && anonId !== user.id) {
  await migrateMcpData(anonId, user.id);
}
```
```

### 4. 前端登录表单改造

**login-form.tsx**：
```typescript
import { getAnonId } from "@/lib/anon-id";

// 提交时带上匿名 ID
const anonId = getAnonId();
const response = await fetch("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ username, password, anonymousId: anonId }),
});
```

**register-form.tsx**：已支持 `anonymousId` 参数，无需额外修改。

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `lib/hooks/use-auth.ts` | 修改 | 使用 getAnonId()，改造 getAuthHeader() |
| `lib/auth/middleware.ts` | 修改 | getAuthContext() 新增 X-Anonymous-Id Header 支持，新增 authenticateRequestOptional() |
| `lib/db/mcp.ts` | 新建 | MCP 数据迁移函数 |
| `app/api/tools/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/[id]/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/[id]/status/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/[id]/tools/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/auth/register/route.ts` | 修改 | 添加 MCP 数据迁移逻辑 |
| `app/api/auth/login/route.ts` | 修改 | 添加 MCP 数据迁移逻辑 |
| `components/auth/login-form.tsx` | 修改 | 登录时传递 anonymousId |

## 认证流程图

```
┌─────────────────────────────────────────────────────────────┐
│                     前端请求 API                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   getAuthHeader()                           │
│  ┌─────────────────┐      ┌─────────────────┐              │
│  │   已登录?       │──是──▶│ Authorization:  │              │
│  │                 │      │ Bearer <jwt>    │              │
│  └────────┬────────┘      └─────────────────┘              │
│           │否                                                │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │ X-Anonymous-Id: │                                        │
│  │ <anon_id>       │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  API 端 getAuthContext()                    │
│                                                             │
│  1. JWT Token? ──是──▶ 返回 userId, isAuthenticated=true    │
│         │否                                                 │
│         ▼                                                   │
│  2. X-Anonymous-Id? ──是──▶ getOrCreateUser(id)            │
│         │否                   返回 userId, isAuthenticated=false
│         ▼                                                   │
│  3. 请求体 anonymousId? ──是──▶ getOrCreateUser(id)        │
│         │否                                                 │
│         ▼                                                   │
│  4. 查询参数 anonymousId? ──是──▶ getOrCreateUser(id)      │
│         │否                                                 │
│         ▼                                                   │
│  返回 userId="", isAuthenticated=false                      │
└─────────────────────────────────────────────────────────────┘
```

## 风险与注意事项

1. **SSR 环境**：`getAnonId()` 在 SSR 环境下返回 `null`，`getAuthHeader()` 会返回空对象。这是预期行为，客户端水合后会正确获取匿名 ID。

2. **匿名用户数据清理**：长期不活跃的匿名用户数据可能需要定期清理（后续可添加定时任务）

3. **安全性**：匿名 ID 存储在 localStorage，用户清除浏览器数据会丢失配置（符合预期）

4. **并发问题**：
   - 迁移时直接覆盖注册用户的 MCP 配置
   - `getOrCreateUser()` 的"先查后建"模式在高并发下可能创建重复用户（实际场景概率极低）

## 测试要点

1. 未登录用户访问 MCP 页面，能正常加载（无错误）
2. 未登录用户能创建/编辑/删除 MCP 服务器
3. 未登录用户能查看工具列表
4. 登录后，匿名期间创建的 MCP 配置自动迁移到注册账户
5. 已登录用户功能不受影响