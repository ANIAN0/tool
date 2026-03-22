# 第3阶段：沙盒服务集成设计文档

> 使用 Zeroboot + Gateway 架构实现Agent沙盒工具

## 1. 概述

### 1.1 目标

- 为Agent提供三个内置沙盒工具：bash、readFile、writeFile
- 用户数据跨会话持久化，按用户ID隔离
- 会话级沙盒实例，闲置30分钟自动销毁VM
- 简化云服务器部署流程

### 1.2 架构图

```
┌────────────────────────┐         ┌────────────────────────┐
│  AgentChat应用服务器    │         │  Sandbox Server        │
│  (云服务器 A)           │  HTTP   │  (云服务器 B)          │
│                        │ ──────▶ │                        │
│  - Next.js应用         │  API    │  - Sandbox Gateway     │
│  - AgentChat API       │  :8080  │  - Zeroboot :8081      │
│  - SandboxSessionMgr   │         │  - 用户数据存储         │
└────────────────────────┘         └────────────────────────┘
```

### 1.3 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 沙盒引擎 | Zeroboot | KVM/Firecracker轻量级VM |
| 网关服务 | Express + Node.js | 认证、会话管理、数据同步 |
| 通信协议 | HTTP API | 内网访问，API Key认证 |

## 2. 数据隔离设计

### 2.1 用户数据存储结构

```
/var/lib/zeroboot/users/
├── {hash(user_id_a)}/           # 用户A的数据
│   ├── workspace/               # 工作空间（持久化）
│   │   ├── project/
│   │   └── .env
│   └── .metadata/               # 元数据
│       ├── created_at
│       └── last_access
│
└── {hash(user_id_b)}/           # 用户B的数据（完全隔离）
    ├── workspace/
    └── ...
```

### 2.2 安全保证

- 按用户ID隔离，同一用户所有对话共享工作空间
- 用户ID经SHA256哈希后作为目录名
- Agent无法指定sessionId或userId，只能在当前用户沙盒中操作

## 3. 会话管理设计

### 3.1 会话生命周期

```
激活会话 → 活跃状态 → 闲置30分钟 → 闲置状态（VM销毁，会话保留）
    │                                              │
    └──────────── 再次激活 ←───────────────────────┘
```

### 3.2 会话绑定关系

| 参数 | 控制方 | 来源 |
|------|--------|------|
| sessionId | 代码 | = conversationId |
| userId | 代码 | = 当前登录用户ID |
| command/relativePath/content | Agent | AI生成 |

### 3.3 自动重建机制

1. 用户数据持久化在磁盘，不随会话销毁
2. 调用exec时自动激活会话（创建VM，加载数据）
3. AgentChat API对调用方透明

### 3.4 并发处理策略

**同一用户多会话并发：**
- 允许同一用户在不同对话（不同sessionId）中并发访问
- 每个会话独立的VM实例，互不影响
- 用户数据共享同一工作空间，采用文件锁机制避免冲突

**文件锁机制：**
```typescript
// 写操作前获取排他锁
const lockPath = `${userDir}/.locks/${relativePath}.lock`;
await acquireLock(lockPath, { exclusive: true });
// 操作完成后释放锁
await releaseLock(lockPath);
```

### 3.5 会话状态持久化

Gateway服务重启后的恢复机制：

1. **用户数据**：存储在磁盘 `/var/lib/zeroboot/users/`，不受影响
2. **会话状态**：存储在内存，重启后丢失
3. **恢复流程**：新请求到达时，自动重新激活会话（从磁盘加载数据）

**可选优化**：使用Redis持久化会话状态（生产环境建议）

```typescript
// Redis存储会话状态
await redis.set(`session:${sessionId}`, JSON.stringify({
  userId,
  status: 'idle',  // 重启后默认为idle
  lastActivity: Date.now(),
}));
```

## 4. API设计

### 4.1 Gateway新增接口

| 方法 | 接口 | 说明 |
|------|------|------|
| POST | `/api/v1/sessions/:id/activate` | 激活会话，创建VM实例 |
| POST | `/api/v1/sessions/:id/heartbeat` | 心跳，保持活跃状态 |
| POST | `/api/v1/sessions/:id/exec` | 执行命令（自动激活） |
| POST | `/api/v1/sessions/:id/read` | 读取文件 |
| POST | `/api/v1/sessions/:id/write` | 写入文件 |
| GET | `/api/v1/sessions/:id/status` | 查询会话状态 |
| DELETE | `/api/v1/sessions/:id` | 销毁会话 |

### 4.2 请求/响应示例

**执行命令：**

```typescript
// POST /api/v1/sessions/:id/exec
// Headers: X-API-Key: sk-xxx
{
  "userId": "user_123",
  "code": "ls -la",
  "language": "bash"
}

// Response
{
  "success": true,
  "stdout": "total 8\ndrwxr-xr-x...",
  "stderr": "",
  "exitCode": 0
}
```

**读取文件：**

```typescript
// POST /api/v1/sessions/:id/read
{
  "userId": "user_123",
  "path": "config.json"
}

// Response
{
  "success": true,
  "content": "{\"key\": \"value\"}"
}
```

**写入文件：**

```typescript
// POST /api/v1/sessions/:id/write
{
  "userId": "user_123",
  "path": "output.txt",
  "content": "Hello World"
}

// Response
{
  "success": true
}
```

## 5. AgentChat API实现

### 5.1 配置管理

所有配置项统一管理，避免重复定义：

```typescript
// lib/sandbox/config.ts

export const SANDBOX_CONFIG = {
  // 从环境变量读取，统一配置源
  gatewayUrl: process.env.SANDBOX_GATEWAY_URL || 'http://sandbox-server:8080',
  apiKey: process.env.SANDBOX_API_KEY || '',
  idleTimeoutMs: parseInt(process.env.SANDBOX_IDLE_TIMEOUT_MS || '1800000'), // 30分钟
  requestTimeoutMs: parseInt(process.env.SANDBOX_REQUEST_TIMEOUT_MS || '60000'), // 60秒
};
```

### 5.2 SandboxSessionManager

```typescript
// lib/sandbox/session-manager.ts

import { SANDBOX_CONFIG } from './config';

// 全局单例实例
let instance: SandboxSessionManager | null = null;

/**
 * 获取SandboxSessionManager单例
 */
export function getSandboxManager(): SandboxSessionManager {
  if (!instance) {
    instance = new SandboxSessionManager();
  }
  return instance;
}

export class SandboxSessionManager {
  private gatewayUrl: string;
  private apiKey: string;

  constructor() {
    this.gatewayUrl = SANDBOX_CONFIG.gatewayUrl;
    this.apiKey = SANDBOX_CONFIG.apiKey;
  }

  /**
   * 执行命令（自动激活会话）
   */
  async exec(params: {
    sessionId: string;
    userId: string;
    code: string;
    language: 'bash' | 'python' | 'node';
  }): Promise<ExecResult>;

  /**
   * 读取文件
   */
  async readFile(params: {
    sessionId: string;
    userId: string;
    relativePath: string;  // 相对于工作空间的路径
  }): Promise<string>;

  /**
   * 写入文件
   */
  async writeFile(params: {
    sessionId: string;
    userId: string;
    relativePath: string;  // 相对于工作空间的路径
    content: string;
  }): Promise<void>;

  /**
   * 发送心跳
   */
  async heartbeat(sessionId: string): Promise<void>;
}
```

### 5.3 内置工具定义

```typescript
// lib/sandbox/tools.ts

import { tool } from 'ai';
import { z } from 'zod';
import { getSandboxManager } from './session-manager';

/**
 * bash工具 - 在沙盒中执行命令
 */
export const bashTool = tool({
  description: '在沙盒环境中执行bash命令',
  parameters: z.object({
    command: z.string().describe('要执行的bash命令'),
  }),
  execute: async ({ command }, context) => {
    const { conversationId, userId } = context;
    // 获取沙盒管理器单例
    const sandboxManager = getSandboxManager();
    return sandboxManager.exec({
      sessionId: conversationId,
      userId,
      code: command,
      language: 'bash',
    });
  },
});

/**
 * readFile工具 - 读取沙盒中的文件
 */
export const readFileTool = tool({
  description: '读取沙盒工作空间中的文件内容',
  parameters: z.object({
    relativePath: z.string().describe('文件路径（相对于工作空间）'),
  }),
  execute: async ({ relativePath }, context) => {
    const { conversationId, userId } = context;
    const sandboxManager = getSandboxManager();
    return sandboxManager.readFile({
      sessionId: conversationId,
      userId,
      relativePath,
    });
  },
});

/**
 * writeFile工具 - 写入文件到沙盒
 */
export const writeFileTool = tool({
  description: '写入文件到沙盒工作空间',
  parameters: z.object({
    relativePath: z.string().describe('文件路径（相对于工作空间）'),
    content: z.string().describe('文件内容'),
  }),
  execute: async ({ relativePath, content }, context) => {
    const { conversationId, userId } = context;
    const sandboxManager = getSandboxManager();
    return sandboxManager.writeFile({
      sessionId: conversationId,
      userId,
      relativePath,
      content,
    });
  },
});
```

### 5.3 AgentChat API集成

修改 `app/api/agent-chat/route.ts`：

```typescript
// 创建沙盒工具
const sandboxTools = {
  bash: bashTool,
  readFile: readFileTool,
  writeFile: writeFileTool,
};

// 合并到Agent工具集
const allTools = {
  ...existingMcpTools,
  ...sandboxTools,
};

// 创建ToolLoopAgent实例
const agentInstance = new ToolLoopAgent({
  model: wrappedModel,
  instructions: systemPrompt,
  tools: allTools,
  stopWhen: stepCountIs(agentTemplateConfig.stepCount || 10),
});
```

## 6. Gateway实现

### 6.1 配置管理

```typescript
// Gateway src/config/index.ts

export const config = {
  gateway: {
    port: parseInt(process.env.GATEWAY_PORT || '8080'),
  },
  zeroboot: {
    url: process.env.ZERBOOT_URL || 'http://127.0.0.1:8081',
    timeout: parseInt(process.env.ZERBOOT_TIMEOUT_MS || '60000'),
  },
  session: {
    idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS || '1800000'), // 30分钟
  },
  storage: {
    userDataRoot: process.env.USER_DATA_ROOT || '/var/lib/zeroboot/users',
  },
  security: {
    apiKey: process.env.API_KEY || '',
    maxCodeSize: parseInt(process.env.MAX_CODE_SIZE || '1048576'), // 1MB
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    maxStoragePerUser: parseInt(process.env.MAX_STORAGE_PER_USER || '1073741824'), // 1GB
  },
};
```

### 6.2 会话服务

```typescript
// Gateway src/services/session.ts

import { config } from '../config';

interface SessionState {
  sessionId: string;
  userId: string;
  status: 'active' | 'idle';
  lastActivity: number;
  vmId?: string;
}

class SessionService {
  private sessions: Map<string, SessionState> = new Map();
  // 使用统一配置
  private readonly IDLE_TIMEOUT = config.session.idleTimeoutMs;

  /**
   * 获取或创建会话
   */
  async getOrCreate(sessionId: string, userId: string): Promise<SessionState> {
    const existing = this.sessions.get(sessionId);

    if (existing?.status === 'active') {
      existing.lastActivity = Date.now();
      return existing;
    }

    return this.activate(sessionId, userId);
  }

  /**
   * 激活会话
   */
  private async activate(sessionId: string, userId: string): Promise<SessionState> {
    // 1. 准备用户数据目录
    const userDir = this.getUserDir(userId);
    await this.ensureUserDir(userDir);

    // 2. 调用Zeroboot创建VM实例
    const vmId = await this.createVM(userDir);

    // 3. 更新会话状态
    const session: SessionState = {
      sessionId,
      userId,
      status: 'active',
      lastActivity: Date.now(),
      vmId,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 闲置检查（定时任务）
   */
  checkIdle(): void {
    const now = Date.now();

    for (const [id, session] of this.sessions) {
      if (session.status === 'active' &&
          now - session.lastActivity > this.IDLE_TIMEOUT) {
        this.deactivate(id);
      }
    }
  }

  /**
   * 停用会话（销毁VM，保留数据）
   */
  private async deactivate(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.vmId) return;

    // 销毁VM实例
    await this.destroyVM(session.vmId);

    // 更新状态
    session.status = 'idle';
    session.vmId = undefined;
  }
}
```

### 6.3 执行服务

```typescript
// Gateway src/services/exec.ts

import * as path from 'path';
import * as fs from 'fs/promises';
import { config } from '../config';

class ExecService {
  /**
   * 在会话沙盒中执行命令
   */
  async exec(
    sessionId: string,
    userId: string,
    code: string,
    language: string
  ): Promise<ExecResult> {
    // 1. 获取或激活会话
    const session = await sessionService.getOrCreate(sessionId, userId);

    // 2. 调用Zeroboot执行
    const result = await zerobootClient.exec({
      vmId: session.vmId,
      code,
      language,
    });

    // 3. 更新最后活动时间
    session.lastActivity = Date.now();

    return result;
  }

  /**
   * 验证路径安全性
   * 防止路径遍历攻击
   */
  private validatePath(userDir: string, relativePath: string): string {
    // 规范化路径
    const normalizedRelative = path.normalize(relativePath);

    // 检查是否包含危险路径片段
    if (normalizedRelative.startsWith('..') || path.isAbsolute(normalizedRelative)) {
      throw new Error('Invalid path: path traversal detected');
    }

    // 构建完整路径
    const fullPath = path.join(userDir, 'workspace', normalizedRelative);

    // 再次验证最终路径在工作空间内
    const workspaceDir = path.join(userDir, 'workspace');
    if (!fullPath.startsWith(workspaceDir)) {
      throw new Error('Invalid path: path escapes workspace');
    }

    return fullPath;
  }

  /**
   * 读取文件
   */
  async readFile(sessionId: string, userId: string, relativePath: string): Promise<string> {
    const userDir = this.getUserDir(userId);

    // 验证路径安全性
    const filePath = this.validatePath(userDir, relativePath);

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${relativePath}`);
    }

    // 检查文件大小
    const stats = await fs.stat(filePath);
    if (stats.size > config.security.maxFileSize) {
      throw new Error(`File too large: max ${config.security.maxFileSize} bytes`);
    }

    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * 写入文件
   */
  async writeFile(
    sessionId: string,
    userId: string,
    relativePath: string,
    content: string
  ): Promise<void> {
    const userDir = this.getUserDir(userId);

    // 验证路径安全性
    const filePath = this.validatePath(userDir, relativePath);

    // 检查内容大小
    if (content.length > config.security.maxFileSize) {
      throw new Error(`Content too large: max ${config.security.maxFileSize} bytes`);
    }

    // 检查用户存储配额
    await this.checkStorageQuota(userDir, content.length);

    // 创建目录并写入文件
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 检查存储配额
   */
  private async checkStorageQuota(userDir: string, additionalBytes: number): Promise<void> {
    const workspaceDir = path.join(userDir, 'workspace');
    const currentSize = await this.getDirSize(workspaceDir);

    if (currentSize + additionalBytes > config.security.maxStoragePerUser) {
      throw new Error(`Storage quota exceeded: max ${config.security.maxStoragePerUser} bytes`);
    }
  }

  /**
   * 计算目录大小
   */
  private async getDirSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirSize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        }
      }
    } catch {
      // 目录不存在，返回0
    }
    return size;
  }
}
```

## 7. 简化部署流程

### 7.1 部署包结构

```
sandbox-deploy/
├── deploy.sh              # 一键部署脚本
├── config/
│   └── .env.example       # 环境变量模板
├── gateway/               # Gateway服务代码
│   ├── package.json
│   └── src/
├── systemd/               # 服务配置
│   ├── zeroboot.service
│   └── sandbox-gateway.service
└── scripts/
    ├── install-system.sh
    ├── setup-user.sh
    └── start-services.sh
```

### 7.2 部署步骤

```bash
# 1. 上传文件夹到云服务器
scp -r sandbox-deploy user@server:/opt/

# 2. 执行部署脚本
cd /opt/sandbox-deploy
chmod +x deploy.sh
sudo ./deploy.sh

# 3. 按提示配置环境变量
# 4. 服务自动启动
```

### 7.3 deploy.sh主要步骤

1. 检查系统环境（KVM支持）
2. 安装系统依赖（qemu-kvm, libvirt等）
3. 创建zeroboot用户和目录
4. 下载并安装Zeroboot二进制
5. 安装Node.js 18+
6. 安装Gateway依赖
7. 配置systemd服务
8. 启动服务
9. 验证服务状态

### 7.4 环境变量配置

```bash
# config/.env
GATEWAY_PORT=8080
ZERBOOT_URL=http://127.0.0.1:8081
USER_DATA_ROOT=/var/lib/zeroboot/users
API_KEY=sk-your-api-key
IDLE_TIMEOUT_MS=1800000
LOG_LEVEL=info
```

## 8. 错误处理

### 8.1 错误类型

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| SESSION_NOT_FOUND | 会话不存在 | 自动创建新会话 |
| VM_CREATION_FAILED | VM创建失败 | 重试3次，返回错误 |
| EXEC_TIMEOUT | 执行超时 | 返回超时错误 |
| FILE_NOT_FOUND | 文件不存在 | 返回错误信息 |
| PERMISSION_DENIED | 权限不足 | 返回错误信息 |

### 8.2 重试机制

- VM创建失败：重试3次，间隔5秒
- API调用失败：重试2次，间隔1秒

## 9. 监控与日志

### 9.1 日志格式

```json
{
  "timestamp": "2025-03-22T10:00:00Z",
  "level": "info",
  "service": "sandbox-gateway",
  "sessionId": "conv_123",
  "userId": "user_456",
  "action": "exec",
  "duration": 150
}
```

### 9.2 监控指标

- 活跃会话数
- VM实例数
- 平均执行时间
- 错误率

## 10. Zeroboot API 参考

### 10.1 核心接口

| 方法 | 接口 | 说明 |
|------|------|------|
| POST | `/v1/exec` | 在VM中执行代码 |
| GET | `/health` | 健康检查 |

### 10.2 执行接口详情

**POST /v1/exec**

```typescript
// 请求
{
  "code": "string",      // 要执行的代码
  "language": "bash" | "python" | "node",  // 语言类型
  "timeout_seconds": 30, // 超时时间（可选）
}

// 响应
{
  "stdout": "string",    // 标准输出
  "stderr": "string",    // 标准错误
  "exit_code": 0,        // 退出码
  "exec_time_ms": 150,   // 执行时间
}
```

### 10.3 VM管理

Zeroboot使用内存快照技术实现快速VM创建（~0.8ms/fork）：

- 预热模板：启动时加载基础VM镜像
- Fork创建：基于CoW的快速实例化
- 自动清理：执行完成后自动销毁

### 10.4 参考文档

- Zeroboot GitHub: https://github.com/anthropics/zeroboot
- API文档：见沙盒服务部署实施文档 `docs/功能开发/沙盒服务部署实施文档.md`

## 11. 安全加固

### 11.1 资源配额

| 资源 | 限制 | 配置项 |
|------|------|--------|
| 单文件大小 | 10 MB | `MAX_FILE_SIZE` |
| 单次代码大小 | 1 MB | `MAX_CODE_SIZE` |
| 用户存储空间 | 1 GB | `MAX_STORAGE_PER_USER` |
| 执行超时 | 60 秒 | `ZERBOOT_TIMEOUT_MS` |
| VM内存 | 512 MB | Zeroboot配置 |
| VM CPU | 1 核 | Zeroboot配置 |

### 11.2 代码执行限制

```typescript
// Gateway src/utils/security.ts

// 禁止的危险命令模式
const FORBIDDEN_PATTERNS = [
  /rm\s+-rf\s+\//,                    // 根目录删除
  /mkfs/,                             // 格式化
  /dd\s+if=/,                         // 直接磁盘操作
  /:(){ :|:& };:/,                   // Fork炸弹
  /curl\s+.+\|\s*(bash|sh)/,         // 远程脚本执行
  /wget\s+.+\|\s*(bash|sh)/,
  /sudo\s+/,                          // 提权
];

function validateCode(code: string): void {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error(`Forbidden command pattern detected`);
    }
  }
}
```

### 11.3 网络安全

```bash
# 仅允许Agent服务器IP访问Gateway
sudo ufw allow from <agent-server-ip> to any port 8080

# Zeroboot仅本地访问
# 默认绑定 127.0.0.1:8081
```

## 12. 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2025-03-22 | 初始设计 |