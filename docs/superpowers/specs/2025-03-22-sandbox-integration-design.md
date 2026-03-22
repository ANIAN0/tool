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
| command/path/content | Agent | AI生成 |

### 3.3 自动重建机制

1. 用户数据持久化在磁盘，不随会话销毁
2. 调用exec时自动激活会话（创建VM，加载数据）
3. AgentChat API对调用方透明

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

### 5.1 SandboxSessionManager

```typescript
// lib/sandbox/session-manager.ts

export class SandboxSessionManager {
  private gatewayUrl: string;
  private apiKey: string;
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000;

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
    path: string;
  }): Promise<string>;

  /**
   * 写入文件
   */
  async writeFile(params: {
    sessionId: string;
    userId: string;
    path: string;
    content: string;
  }): Promise<void>;

  /**
   * 发送心跳
   */
  async heartbeat(sessionId: string): Promise<void>;
}
```

### 5.2 内置工具定义

```typescript
// lib/sandbox/tools.ts

import { tool } from 'ai';
import { z } from 'zod';

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
    path: z.string().describe('文件路径（相对于工作空间）'),
  }),
  execute: async ({ path }, context) => {
    const { conversationId, userId } = context;
    return sandboxManager.readFile({
      sessionId: conversationId,
      userId,
      path,
    });
  },
});

/**
 * writeFile工具 - 写入文件到沙盒
 */
export const writeFileTool = tool({
  description: '写入文件到沙盒工作空间',
  parameters: z.object({
    path: z.string().describe('文件路径（相对于工作空间）'),
    content: z.string().describe('文件内容'),
  }),
  execute: async ({ path, content }, context) => {
    const { conversationId, userId } = context;
    return sandboxManager.writeFile({
      sessionId: conversationId,
      userId,
      path,
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

### 6.1 会话服务

```typescript
// Gateway src/services/session.ts

interface SessionState {
  sessionId: string;
  userId: string;
  status: 'active' | 'idle';
  lastActivity: number;
  vmId?: string;
}

class SessionService {
  private sessions: Map<string, SessionState> = new Map();
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000;

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

### 6.2 执行服务

```typescript
// Gateway src/services/exec.ts

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
   * 读取文件
   */
  async readFile(sessionId: string, userId: string, path: string): Promise<string> {
    const userDir = this.getUserDir(userId);
    const filePath = path.join(userDir, 'workspace', path);

    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * 写入文件
   */
  async writeFile(
    sessionId: string,
    userId: string,
    path: string,
    content: string
  ): Promise<void> {
    const userDir = this.getUserDir(userId);
    const filePath = path.join(userDir, 'workspace', path);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
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

## 10. 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2025-03-22 | 初始设计 |