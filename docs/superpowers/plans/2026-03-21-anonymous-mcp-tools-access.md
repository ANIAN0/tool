# 匿名用户 MCP/Tools 访问支持实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许未登录用户访问 MCP 和 Tools 功能，每个匿名用户拥有独立配置，登录后自动迁移到注册账户。

**Architecture:** 统一匿名 ID 机制（使用 lib/anon-id.ts），API 端支持 X-Anonymous-Id Header，登录/注册时自动迁移 MCP 数据。

**Tech Stack:** Next.js App Router, TypeScript, SQLite (turso), nanoid

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/db/mcp.ts` | 新建 | MCP 数据迁移函数 |
| `lib/auth/middleware.ts` | 修改 | 新增 X-Anonymous-Id Header 支持，新增 authenticateRequestOptional() |
| `lib/hooks/use-auth.ts` | 修改 | 统一匿名 ID，改造 getAuthHeader() |
| `app/api/tools/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/[id]/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/[id]/status/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/mcp/[id]/tools/route.ts` | 修改 | 使用 authenticateRequestOptional() |
| `app/api/auth/register/route.ts` | 修改 | 添加 MCP 数据迁移 |
| `app/api/auth/login/route.ts` | 修改 | 添加 anonymousId 参数和 MCP 数据迁移 |
| `components/auth/login-form.tsx` | 修改 | 登录时传递 anonymousId |

---

## Chunk 1: 基础设施 - 数据迁移函数和认证中间件

### Task 1: 创建 MCP 数据迁移函数

**Files:**
- Create: `lib/db/mcp.ts`

- [ ] **Step 1: 创建 lib/db/mcp.ts 文件**

```typescript
/**
 * MCP 数据库操作函数
 * 提供 MCP 服务器数据的迁移等功能
 */

import { getDb } from "./client";

/**
 * 迁移 MCP 服务器数据到新用户
 * 将原用户的 MCP 服务器配置迁移到目标用户
 *
 * @param fromUserId - 原用户ID（匿名用户）
 * @param toUserId - 目标用户ID（注册用户）
 */
export async function migrateMcpData(
  fromUserId: string,
  toUserId: string
): Promise<void> {
  const db = getDb();

  // 将匿名用户的 MCP 服务器迁移到注册账户
  await db.execute({
    sql: `UPDATE user_mcp_servers SET user_id = ? WHERE user_id = ?`,
    args: [toUserId, fromUserId],
  });

  // MCP 工具通过 server_id 关联，无需单独迁移
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/db/mcp.ts
git commit -m "feat(db): 添加 MCP 数据迁移函数"
```

---

### Task 2: 增强认证中间件 - 新增 X-Anonymous-Id Header 支持

**Files:**
- Modify: `lib/auth/middleware.ts:41-91`

- [ ] **Step 1: 修改 getAuthContext() 函数，新增 X-Anonymous-Id Header 支持**

在 `lib/auth/middleware.ts` 中，找到 `getAuthContext` 函数。在第 57 行（JWT Token 验证块结束后）与第 59 行（POST body 检查开始前）之间插入以下代码：

```typescript
  // 尝试从 X-Anonymous-Id Header 获取匿名用户ID
  const anonIdHeader = request.headers.get("X-Anonymous-Id");
  if (anonIdHeader) {
    const user = await getOrCreateUser(anonIdHeader);
    return {
      userId: user.id,
      isAuthenticated: false,
    };
  }
```

修改后的 `getAuthContext` 函数完整代码：

```typescript
export async function getAuthContext(
  request: NextRequest
): Promise<AuthContext> {
  // 尝试从Authorization头获取JWT令牌
  const authHeader = request.headers.get("Authorization");
  const token = extractAccessToken(authHeader);

  if (token) {
    // 验证JWT令牌
    const result = verifyAccessToken(token);
    if (result.valid && result.payload) {
      return {
        userId: result.payload.userId,
        isAuthenticated: true,
      };
    }
  }

  // 尝试从 X-Anonymous-Id Header 获取匿名用户ID（新增）
  const anonIdHeader = request.headers.get("X-Anonymous-Id");
  if (anonIdHeader) {
    const user = await getOrCreateUser(anonIdHeader);
    return {
      userId: user.id,
      isAuthenticated: false,
    };
  }

  // 尝试从请求体获取匿名用户ID（仅POST请求）
  if (request.method === "POST") {
    try {
      const body = await request.clone().json();
      if (body.anonymousId && typeof body.anonymousId === "string") {
        // 确保用户存在
        const user = await getOrCreateUser(body.anonymousId);
        return {
          userId: user.id,
          isAuthenticated: false,
        };
      }
    } catch {
      // 解析失败，忽略
    }
  }

  // 尝试从查询参数获取匿名用户ID
  const anonymousId = request.nextUrl.searchParams.get("anonymousId");
  if (anonymousId) {
    const user = await getOrCreateUser(anonymousId);
    return {
      userId: user.id,
      isAuthenticated: false,
    };
  }

  // 无法识别用户
  return {
    userId: "",
    isAuthenticated: false,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/auth/middleware.ts
git commit -m "feat(auth): getAuthContext 支持 X-Anonymous-Id Header"
```

---

### Task 3: 新增 authenticateRequestOptional() 函数

**Files:**
- Modify: `lib/auth/middleware.ts`

- [ ] **Step 1: 在 authenticateRequest() 函数后添加新函数**

在 `lib/auth/middleware.ts` 文件末尾（约第 227 行后）添加：

```typescript
/**
 * 可选认证请求验证 - 支持匿名用户和认证用户
 * 用于需要识别用户身份但允许匿名的 API 端点
 *
 * @param request - Next.js请求对象
 * @returns 认证结果，包含userId或错误信息
 */
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

- [ ] **Step 2: 提交**

```bash
git add lib/auth/middleware.ts
git commit -m "feat(auth): 新增 authenticateRequestOptional 支持匿名用户"
```

---

### Task 4: 改造 useAuth Hook - 统一匿名 ID

**Files:**
- Modify: `lib/hooks/use-auth.ts`

- [ ] **Step 1: 导入 getAnonId**

在文件顶部（约第 9 行后）添加导入：

```typescript
import { getAnonId } from "@/lib/anon-id";
```

- [ ] **Step 2: 移除 getStoredAnonymousId 死代码**

删除第 90-98 行的 `getStoredAnonymousId` 函数：

```typescript
// 删除以下代码：
/**
 * 获取存储的匿名用户ID
 * 优先从 localStorage 获取，其次 sessionStorage
 */
function getStoredAnonymousId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("anonymous_user_id") ||
         sessionStorage.getItem("anonymous_user_id");
}
```

- [ ] **Step 3: 修改 initAuth 中的 anonymousId 获取**

修改第 209 行：

```typescript
// 修改前：
setAnonymousId(getStoredAnonymousId());

// 修改后：
setAnonymousId(getAnonId());
```

- [ ] **Step 4: 改造 getAuthHeader 函数**

修改第 290-296 行的 `getAuthHeader` 函数：

```typescript
// 修改前：
const getAuthHeader = useCallback((): Record<string, string> => {
  const { accessToken } = state;
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}, [state]);

// 修改后：
const getAuthHeader = useCallback((): Record<string, string> => {
  // 已登录用户使用 JWT Token
  const { accessToken } = state;
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  // 未登录用户使用匿名 ID
  const anonId = getAnonId();
  if (anonId) {
    return { "X-Anonymous-Id": anonId };
  }

  return {};
}, [state]);
```

- [ ] **Step 5: 提交**

```bash
git add lib/hooks/use-auth.ts
git commit -m "feat(auth): 统一匿名 ID 机制，getAuthHeader 支持匿名用户"
```

---

## Chunk 2: API 路由改造 - 支持匿名用户

### Task 5: 改造 /api/tools 路由

**Files:**
- Modify: `app/api/tools/route.ts`

- [ ] **Step 1: 导入 authenticateRequestOptional**

修改第 8 行：

```typescript
// 修改前：
import { authenticateRequest } from "@/lib/auth/middleware";

// 修改后：
import { authenticateRequestOptional } from "@/lib/auth/middleware";
```

- [ ] **Step 2: 替换认证函数调用**

修改第 17 行：

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 3: 提交**

```bash
git add app/api/tools/route.ts
git commit -m "feat(api): /api/tools 支持匿名用户访问"
```

---

### Task 6: 改造 /api/mcp 路由

**Files:**
- Modify: `app/api/mcp/route.ts`

- [ ] **Step 1: 导入 authenticateRequestOptional**

修改第 8 行：

```typescript
// 修改前：
import { authenticateRequest } from "@/lib/auth/middleware";

// 修改后：
import { authenticateRequestOptional } from "@/lib/auth/middleware";
```

- [ ] **Step 2: 替换 GET 方法中的认证调用**

修改第 32 行：

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 3: 替换 POST 方法中的认证调用**

修改第 97 行：

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 4: 提交**

```bash
git add app/api/mcp/route.ts
git commit -m "feat(api): /api/mcp 支持匿名用户访问"
```

---

### Task 7: 改造 /api/mcp/[id] 路由

**Files:**
- Modify: `app/api/mcp/[id]/route.ts`

- [ ] **Step 1: 导入 authenticateRequestOptional**

修改第 8 行：

```typescript
// 修改前：
import { authenticateRequest } from "@/lib/auth/middleware";

// 修改后：
import { authenticateRequestOptional } from "@/lib/auth/middleware";
```

- [ ] **Step 2: 替换 GET 方法中的认证调用（第 34 行）**

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 3: 替换 PUT 方法中的认证调用（第 111 行）**

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 4: 替换 DELETE 方法中的认证调用（第 290 行）**

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 5: 提交**

```bash
git add app/api/mcp/[id]/route.ts
git commit -m "feat(api): /api/mcp/[id] 支持匿名用户访问"
```

---

### Task 8: 改造 /api/mcp/[id]/status 路由

**Files:**
- Modify: `app/api/mcp/[id]/status/route.ts`

- [ ] **Step 1: 导入 authenticateRequestOptional**

修改第 8 行：

```typescript
// 修改前：
import { authenticateRequest } from "@/lib/auth/middleware";

// 修改后：
import { authenticateRequestOptional } from "@/lib/auth/middleware";
```

- [ ] **Step 2: 替换认证调用（第 255 行）**

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 3: 提交**

```bash
git add app/api/mcp/[id]/status/route.ts
git commit -m "feat(api): /api/mcp/[id]/status 支持匿名用户访问"
```

---

### Task 9: 改造 /api/mcp/[id]/tools 路由

**Files:**
- Modify: `app/api/mcp/[id]/tools/route.ts`

- [ ] **Step 1: 导入 authenticateRequestOptional**

修改第 8 行：

```typescript
// 修改前：
import { authenticateRequest } from "@/lib/auth/middleware";

// 修改后：
import { authenticateRequestOptional } from "@/lib/auth/middleware";
```

- [ ] **Step 2: 替换认证调用（第 20 行）**

```typescript
// 修改前：
const authResult = await authenticateRequest(request);

// 修改后：
const authResult = await authenticateRequestOptional(request);
```

- [ ] **Step 3: 提交**

```bash
git add app/api/mcp/[id]/tools/route.ts
git commit -m "feat(api): /api/mcp/[id]/tools 支持匿名用户访问"
```

---

## Chunk 3: 登录/注册 - 数据迁移

### Task 10: 改造登录 API - 添加数据迁移

**Files:**
- Modify: `app/api/auth/login/route.ts`

- [ ] **Step 1: 添加 anonymousId 到请求类型**

修改第 6-9 行：

```typescript
// 修改前：
interface LoginRequest {
  username: string;
  password: string;
}

// 修改后：
interface LoginRequest {
  username: string;
  password: string;
  anonymousId?: string; // 匿名用户ID，用于数据迁移
}
```

- [ ] **Step 2: 导入迁移函数**

在文件顶部添加导入：

```typescript
import { migrateMcpData } from "@/lib/db/mcp";
```

- [ ] **Step 3: 在登录成功后添加迁移逻辑**

在第 82-83 行（生成令牌对之后）添加迁移逻辑：

```typescript
// 生成令牌对
const { accessToken, refreshToken } = generateTokenPair(user.id);

// 迁移匿名用户数据（新增）
const anonId = body.anonymousId;
if (anonId && anonId !== user.id) {
  try {
    await migrateMcpData(anonId, user.id);
  } catch (error) {
    // 迁移失败不影响登录流程，仅记录日志
    console.error("迁移 MCP 数据失败:", error);
  }
}

return NextResponse.json({
```

- [ ] **Step 4: 提交**

```bash
git add app/api/auth/login/route.ts
git commit -m "feat(auth): 登录时自动迁移匿名用户 MCP 数据"
```

---

### Task 11: 改造注册 API - 添加 MCP 数据迁移

**Files:**
- Modify: `app/api/auth/register/route.ts`

- [ ] **Step 1: 导入迁移函数**

在第 8 行后添加：

```typescript
import { migrateMcpData } from "@/lib/db/mcp";
```

- [ ] **Step 2: 在注册成功后添加迁移逻辑**

在 user 赋值完成后（第 135 行之后）、生成令牌对之前（第 137 行）添加迁移逻辑：

```typescript
    }

    // 迁移匿名用户 MCP 数据（新增）
    if (anonymousId && anonymousId !== user.id) {
      try {
        await migrateMcpData(anonymousId, user.id);
      } catch (error) {
        // 迁移失败不影响注册流程，仅记录日志
        console.error("迁移 MCP 数据失败:", error);
      }
    }

    // 生成令牌对
    const { accessToken, refreshToken } = generateTokenPair(user.id);
```

- [ ] **Step 3: 提交**

```bash
git add app/api/auth/register/route.ts
git commit -m "feat(auth): 注册时自动迁移匿名用户 MCP 数据"
```

---

### Task 12: 改造登录表单 - 传递 anonymousId

**Files:**
- Modify: `components/auth/login-form.tsx`

- [ ] **Step 1: 修改导入语句**

修改第 11 行：

```typescript
// 修改前：
import { setAnonId } from "@/lib/anon-id";

// 修改后：
import { getAnonId, setAnonId } from "@/lib/anon-id";
```

- [ ] **Step 2: 修改 handleSubmit 函数**

修改第 69-73 行：

```typescript
// 修改前：
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(formData),
});

// 修改后：
const anonId = getAnonId();
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...formData,
    anonymousId: anonId,
  }),
});
```

- [ ] **Step 3: 提交**

```bash
git add components/auth/login-form.tsx
git commit -m "feat(auth): 登录表单传递 anonymousId 用于数据迁移"
```

---

## Chunk 4: 最终验证

### Task 13: 验证和测试

- [ ] **Step 1: 确保项目能正常构建**

```bash
npm run build
```

- [ ] **Step 2: 手动测试未登录访问 MCP 页面**

1. 清除浏览器 localStorage 或使用隐身模式
2. 访问 `/settings/mcp` 页面
3. 预期：页面正常加载，无"未提供认证令牌"错误

- [ ] **Step 3: 手动测试匿名用户创建 MCP 服务器**

1. 未登录状态下创建一个 MCP 服务器
2. 预期：创建成功

- [ ] **Step 4: 手动测试登录后数据迁移**

1. 记录匿名状态下创建的 MCP 服务器
2. 登录账户
3. 预期：之前创建的 MCP 服务器出现在账户中

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: 完成匿名用户 MCP/Tools 访问支持"
```