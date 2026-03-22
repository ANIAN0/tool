# 沙盒服务设计方案

> 基于 nsjail 的轻量级代码沙盒服务，适用于无虚拟化支持的云服务器环境

## 1. 背景

### 1.1 问题

现有沙盒方案基于 KVM/QEMU + Zeroboot，需要 CPU 支持 VT-x/AMD-V 虚拟化。云服务器不支持虚拟化，导致方案不可行。

### 1.2 需求

| 需求项 | 要求 |
|--------|------|
| 安全隔离 | 处理不可信代码，防止逃逸 |
| 内存限制 | < 100MB per session |
| 执行时间 | 60秒+ |
| 网络访问 | 允许 |
| 并发能力 | 1-2 个沙盒同时运行 |
| 服务器配置 | 2核/2G内存 |
| 部署方式 | 独立于 AgentChat，通过外网通讯 |

### 1.3 技术选型

**选择 nsjail**，理由：

| 方案 | 内存开销 | 安全性 | 适用性 |
|------|---------|--------|--------|
| nsjail | ~5-10MB | 高 (CTF验证) | ✅ 最适合 |
| LXC/LXD | ~30-50MB | 高 | 配置复杂 |
| Docker | ~20-40MB | 中 (需硬化) | 开销较大 |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│              AgentChat 应用服务器 (服务器A)                    │
│  lib/sandbox/tools.ts → HTTP/HTTPS API                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ 外网通讯 (HTTPS + API Key)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│             sandbox-service (服务器B) :8443                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ TLS/认证     │  │ 会话管理    │  │ 用户数据持久化       │  │
│  │ (HTTPS)     │  │ (Session)   │  │ (/var/lib/sandbox)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ 子进程调用 (root)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      nsjail                                   │
│         Linux namespace + seccomp + cgroup 隔离               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
sandbox-service/                    # 独立沙盒服务项目 (Python)
├── src/
│   ├── __init__.py
│   ├── main.py                     # FastAPI 应用入口
│   ├── config.py                   # 配置管理
│   ├── routes/
│   │   ├── __init__.py
│   │   └── api.py                  # API 路由
│   ├── services/
│   │   ├── __init__.py
│   │   ├── sandbox.py              # nsjail 封装
│   │   └── session.py              # 会话管理
│   └── utils/
│       ├── __init__.py
│       └── security.py             # 安全工具
├── config/
│   ├── nsjail.conf                 # nsjail 配置模板
│   └── languages/                  # 语言运行时配置
│       ├── bash.conf
│       ├── python.conf
│       └── node.conf
├── deploy/
│   ├── install.sh                  # 安装脚本
│   ├── sandbox-service.service     # systemd 服务
│   └── requirements.txt            # Python 依赖
├── tests/
│   ├── __init__.py
│   ├── test_sandbox.py             # 单元测试
│   └── test_api.py                 # API 测试
├── .env.example                    # 环境变量模板
└── README.md
```

---

## 3. API 接口设计

### 3.1 认证方式

所有请求需要 HTTPS + API Key 双重认证：

```http
Host: sandbox.example.com:8443
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

### 3.2 接口列表

#### 执行命令

```http
POST /api/v1/sessions/{sessionId}/exec
Authorization: Bearer <API_KEY>

{
  "userId": "user-123",
  "code": "echo 'Hello World'",
  "language": "bash"
}
```

**响应:**
```json
{
  "success": true,
  "stdout": "Hello World\n",
  "stderr": "",
  "exitCode": 0,
  "execTimeMs": 150
}
```

#### 读取文件

```http
POST /api/v1/sessions/{sessionId}/read
Authorization: Bearer <API_KEY>

{
  "userId": "user-123",
  "path": "config.json"
}
```

**响应:**
```json
{
  "success": true,
  "content": "{\"key\": \"value\"}"
}
```

#### 写入文件

```http
POST /api/v1/sessions/{sessionId}/write
Authorization: Bearer <API_KEY>

{
  "userId": "user-123",
  "path": "output.txt",
  "content": "Hello from sandbox!"
}
```

**响应:**
```json
{
  "success": true
}
```

#### 心跳

```http
POST /api/v1/sessions/{sessionId}/heartbeat
Authorization: Bearer <API_KEY>
```

**响应:**
```json
{
  "success": true
}
```

#### 状态查询

```http
GET /api/v1/sessions/{sessionId}/status
Authorization: Bearer <API_KEY>
```

**响应:**
```json
{
  "status": "active",
  "lastActivity": 1711094400000
}
```

#### 健康检查

```http
GET /health
```

**响应:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-22T10:00:00.000Z",
  "version": "1.0.0"
}
```

### 3.3 错误响应格式

所有 API 错误使用统一格式：

```json
{
  "success": false,
  "error": {
    "code": "EXEC_TIMEOUT",
    "message": "执行超时：命令运行超过 60 秒",
    "details": {}
  }
}
```

**错误码定义：**

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `UNAUTHORIZED` | 401 | API Key 无效或缺失 |
| `INVALID_REQUEST` | 400 | 请求参数错误 |
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `EXEC_TIMEOUT` | 408 | 执行超时 |
| `MEMORY_EXCEEDED` | 409 | 内存限制超出 |
| `STORAGE_EXCEEDED` | 409 | 存储配额超出 |
| `PATH_TRAVERSAL` | 403 | 路径遍历攻击检测 |
| `LANGUAGE_NOT_SUPPORTED` | 400 | 不支持的语言 |
| `INTERNAL_ERROR` | 500 | 内部服务错误 |
| `RATE_LIMITED` | 429 | 请求过于频繁 |

### 3.4 速率限制

外网暴露的服务必须实施速率限制：

| 维度 | 限制 | 说明 |
|------|------|------|
| IP 级别 | 100 请求/分钟 | 单个 IP 地址 |
| API Key 级别 | 500 请求/分钟 | 单个 API Key |
| 会话级别 | 30 次执行/分钟 | 单个会话执行次数 |

超出限制返回：
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "请求过于频繁，请 60 秒后重试",
    "details": {
      "retryAfter": 60
    }
  }
}
```

---

## 4. nsjail 配置

### 4.1 主配置文件

```ini
# config/nsjail.conf

# ==================== 模式设置 ====================
mode: ONCE  # 单次执行模式（每次执行单独调用nsjail）

# ==================== 资源限制 ====================
# 内存限制 100MB
cgroup_mem_max: 104857600

# CPU 时间限制 (秒)
cgroup_cpu_max: 60

# 执行超时 (秒)
time_limit: 60

# 最大进程数
max_procs: 10

# ==================== 隔离设置 ====================
# 用户命名空间隔离
clone_newuser: true

# 挂载命名空间隔离
clone_newns: true

# PID命名空间隔离
clone_newpid: true

# IPC命名空间隔离
clone_newipc: true

# 网络命名空间 (false = 允许网络访问)
clone_newnet: false

# UTS命名空间隔离
clone_newuts: true

# ==================== 安全设置 ====================
# 禁止提权
no_new_privs: true

# 根目录 (chroot)
chroot_dir: /var/lib/sandbox/rootfs

# 工作目录
cwd: /workspace

# ==================== 用户映射 ====================
# 将容器内的 root 映射到宿主机的 nobody
uid_map: 0 65534 1
gid_map: 0 65534 1

# ==================== 挂载点 ====================
# 工作空间挂载（每个用户独立的 workspace）
# 注意：使用 chroot_dir 后，mount 目标路径相对于 chroot 内部
# rootfs 已包含最小化的二进制和库，无需额外挂载系统目录
mount: /var/lib/sandbox/users/{USER_HASH}/workspace:/workspace:rw

# ==================== seccomp 过滤 ====================
# 安全的系统调用白名单
# 已移除危险调用：mount/umount/chroot/pivot_root/reboot/kexec/bpf/unshare/ptrace
# 仅允许进程执行和文件操作所需的基础调用
seccomp_string: "ALLOW { read, write, open, close, stat, fstat, lstat, poll, lseek, mmap, mprotect, munmap, brk, rt_sigaction, rt_sigprocmask, rt_sigreturn, ioctl, pread64, pwrite64, readv, writev, access, pipe, select, sched_yield, mremap, msync, mincore, madvise, dup, dup2, dup3, pause, getitimer, alarm, setitimer, getpid, getppid, getpgrp, getpgid, getsid, sendfile, socket, connect, accept, accept4, sendto, recvfrom, sendmsg, recvmsg, shutdown, bind, listen, getsockname, getpeername, socketpair, setsockopt, getsockopt, fork, vfork, clone, execve, exit, exit_group, wait4, waitid, kill, uname, fcntl, flock, fsync, fdatasync, truncate, ftruncate, getdents, getdents64, getcwd, chdir, fchdir, rename, renameat, renameat2, mkdir, mkdirat, rmdir, creat, link, linkat, unlink, unlinkat, symlink, symlinkat, readlink, readlinkat, chmod, fchmod, fchmodat, chown, fchown, lchown, fchownat, umask, gettimeofday, getrlimit, getrusage, sysinfo, times, getuid, getgid, setuid, setgid, geteuid, getegid, setpgid, setreuid, setregid, getgroups, setgroups, setresuid, getresuid, setresgid, getresgid, setfsuid, setfsgid, capget, capset, rt_sigpending, rt_sigtimedwait, rt_sigqueueinfo, sigaltstack, utime, utimes, utimensat, mknod, mknodat, personality, statfs, fstatfs, getpriority, setpriority, sched_setparam, sched_getparam, sched_setscheduler, sched_getscheduler, sched_get_priority_max, sched_get_priority_min, sched_rr_get_interval, sched_setaffinity, sched_getaffinity, mlock, munlock, mlockall, munlockall, prctl, arch_prctl, gettid, readahead, setxattr, lsetxattr, fsetxattr, getxattr, lgetxattr, fgetxattr, listxattr, llistxattr, flistxattr, removexattr, lremovexattr, fremovexattr, tkill, tgkill, time, futex, set_thread_area, get_thread_area, set_robust_list, get_robust_list, remap_file_pages, set_tid_address, restart_syscall, semtimedop, fadvise64, timer_create, timer_settime, timer_gettime, timer_getoverrun, timer_delete, clock_settime, clock_gettime, clock_getres, clock_nanosleep, epoll_create, epoll_create1, epoll_ctl, epoll_wait, epoll_pwait, signalfd, signalfd4, timerfd_create, timerfd_settime, timerfd_gettime, eventfd, eventfd2, inotify_init, inotify_init1, inotify_add_watch, inotify_rm_watch, openat, newfstatat, faccessat, pselect6, ppoll, splice, tee, sync_file_range, vmsplice, fanotify_init, fanotify_mark, prlimit64, name_to_handle_at, open_by_handle_at, syncfs, sendmmsg, recvmmsg, getcpu, process_vm_readv, process_vm_writev, kcmp, finit_module, sched_setattr, sched_getattr, seccomp, getrandom, memfd_create, execveat, membarrier, mlock2, copy_file_range, preadv, preadv2, pwritev, pwritev2, pkey_mprotect, pkey_alloc, pkey_free, statx, fallocate, sync, fadvise }"
```

**配置说明：**

使用 `chroot_dir` 指向最小化的 rootfs，所有必要的二进制和库已在 rootfs 创建时复制。无需额外挂载宿主机系统目录，这确保了：
1. 隔离性：沙盒内只能访问 rootfs 中的最小化环境
2. 安全性：无法访问宿主机的其他二进制和库
3. 一致性：每个沙盒使用相同的最小化环境

### 4.2 语言运行时说明

运行时已在 rootfs 创建时预置，无需额外配置：
- **bash**: `/bin/bash` (已在 rootfs)
- **Python3**: `/usr/bin/python3` + 依赖库 (已在 rootfs)
- **Node.js**: `/usr/bin/node` + 标准库 (已在 rootfs)

如需添加新语言支持，更新安装脚本中的 rootfs 创建部分即可。

---

## 5. 安全设计

### 5.1 多层防护

| 层级 | 措施 | 目的 |
|------|------|------|
| 网络层 | HTTPS + TLS 1.3 | 防止中间人攻击 |
| 认证层 | Bearer Token | 身份验证 |
| 应用层 | 用户隔离 + 路径验证 | 数据隔离 |
| 系统层 | namespace + seccomp + cgroup | 进程隔离 |

### 5.2 用户数据隔离

```
/var/lib/sandbox/
├── rootfs/                    # 最小化根文件系统
│   ├── bin/
│   ├── usr/
│   ├── lib/
│   └── tmp/
└── users/
    ├── a1b2c3.../             # SHA256(userId)[:16]
    │   └── workspace/
    ├── d4e5f6.../
    │   └── workspace/
    └── ...
```

### 5.3 外网通讯安全

1. **HTTPS 强制**：服务仅监听 8443 端口，强制 TLS
2. **证书要求**：使用 Let's Encrypt 或自签名证书
3. **API Key**：32+ 字符随机字符串
4. **请求签名**：可选的请求时间戳防重放

### 5.4 危险操作防护

```python
# 路径遍历防护
def validate_path(user_dir: str, relative_path: str) -> str:
    normalized = os.path.normpath(relative_path)
    if normalized.startswith('..') or os.path.isabs(normalized):
        raise ValueError("Invalid path: path traversal detected")

    full_path = os.path.join(user_dir, 'workspace', normalized)
    if not full_path.startswith(os.path.join(user_dir, 'workspace')):
        raise ValueError("Invalid path: path escapes workspace")

    return full_path
```

---

## 6. 核心实现

### 6.1 Sandbox 服务类

```python
# src/services/sandbox.py

import subprocess
import tempfile
import os
from pathlib import Path
from typing import Optional

class NsjailSandbox:
    """nsjail 沙盒执行器"""

    def __init__(self, config_path: str = "/etc/sandbox/nsjail.conf"):
        self.config_path = config_path
        self.nsjail_path = "/usr/local/bin/nsjail"

    async def exec(
        self,
        code: str,
        language: str,
        workdir: str,
        timeout: int = 60,
        memory_limit: int = 100 * 1024 * 1024  # 100MB
    ) -> dict:
        """
        在沙盒中执行代码

        Args:
            code: 要执行的代码
            language: 语言 (bash/python/node)
            workdir: 工作目录
            timeout: 超时秒数
            memory_limit: 内存限制字节

        Returns:
            {stdout, stderr, exit_code, exec_time_ms}
        """
        # 创建临时脚本文件
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix=self._get_suffix(language),
            dir=workdir,
            delete=False
        ) as f:
            f.write(code)
            script_path = f.name

        try:
            # 构建 nsjail 命令
            cmd = self._build_command(
                script_path=script_path,
                workdir=workdir,
                language=language,
                timeout=timeout
            )

            # 执行
            import asyncio
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout + 5  # 额外5秒缓冲
                )
            except asyncio.TimeoutError:
                proc.kill()
                raise TimeoutError(f"Execution timed out after {timeout}s")

            return {
                "stdout": stdout.decode('utf-8', errors='replace'),
                "stderr": stderr.decode('utf-8', errors='replace'),
                "exit_code": proc.returncode or 0,
                "exec_time_ms": 0  # TODO: 精确计时
            }

        finally:
            # 清理临时文件
            if os.path.exists(script_path):
                os.unlink(script_path)

    def _build_command(
        self,
        script_path: str,
        workdir: str,
        language: str,
        timeout: int
    ) -> list:
        """构建 nsjail 命令"""
        cmd = [
            self.nsjail_path,
            "--config", self.config_path,
            "--time_limit", str(timeout),
            "--cwd", workdir,
        ]

        # 根据语言选择执行器
        if language == "bash":
            cmd.extend(["--", "/bin/bash", script_path])
        elif language == "python":
            cmd.extend(["--", "/usr/bin/python3", script_path])
        elif language == "node":
            cmd.extend(["--", "/usr/bin/node", script_path])
        else:
            raise ValueError(f"Unsupported language: {language}")

        return cmd

    def _get_suffix(self, language: str) -> str:
        return {
            "bash": ".sh",
            "python": ".py",
            "node": ".js"
        }.get(language, ".txt")
```

### 6.2 会话管理

```python
# src/services/session.py

import os
import hashlib
import time
from typing import Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Session:
    id: str
    user_id: str
    user_dir: str
    status: str = "active"
    created_at: float = 0
    last_activity: float = 0

class SessionManager:
    """会话管理器"""

    def __init__(self, data_root: str = "/var/lib/sandbox/users"):
        self.data_root = data_root
        self.sessions: dict[str, Session] = {}
        self.idle_timeout = 30 * 60  # 30分钟

    def get_or_create(self, session_id: str, user_id: str) -> Session:
        """获取或创建会话"""
        now = time.time()

        if session_id in self.sessions:
            session = self.sessions[session_id]
            session.last_activity = now
            return session

        # 创建新会话
        user_hash = self._hash_user_id(user_id)
        user_dir = os.path.join(self.data_root, user_hash)
        workspace_dir = os.path.join(user_dir, "workspace")

        # 确保目录存在
        os.makedirs(workspace_dir, exist_ok=True)
        os.chmod(user_dir, 0o700)

        session = Session(
            id=session_id,
            user_id=user_id,
            user_dir=user_dir,
            created_at=now,
            last_activity=now
        )
        self.sessions[session_id] = session
        return session

    def update_activity(self, session_id: str):
        """更新会话活动时间"""
        if session_id in self.sessions:
            self.sessions[session_id].last_activity = time.time()

    def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        return self.sessions.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """删除会话（不删除用户数据）"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

    def cleanup_expired(self) -> int:
        """
        清理过期会话
        返回清理的会话数量
        """
        now = time.time()
        expired = [
            sid for sid, session in self.sessions.items()
            if now - session.last_activity > self.idle_timeout
        ]
        for sid in expired:
            del self.sessions[sid]
        return len(expired)

    def _hash_user_id(self, user_id: str) -> str:
        """对用户ID进行哈希处理"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:16]
```

**会话清理策略：**

| 场景 | 行为 |
|------|------|
| 会话闲置超时 | 从内存中移除会话对象，保留用户数据 |
| 服务重启 | 会话状态丢失，用户数据持久化在磁盘 |
| 用户请求删除 | 清理会话，保留用户数据（可选删除） |

**定时清理任务：**
```python
# 每 5 分钟检查过期会话
import asyncio

async def cleanup_task(session_manager: SessionManager):
    while True:
        await asyncio.sleep(300)  # 5分钟
        cleaned = session_manager.cleanup_expired()
        if cleaned > 0:
            print(f"[Cleanup] Removed {cleaned} expired sessions")
```

### 6.3 用户数据生命周期管理

**数据保留策略：**

| 数据类型 | 保留时间 | 清理方式 |
|---------|---------|---------|
| 活跃用户数据 | 永久 | 用户主动删除 |
| 闲置用户数据 | 30天 | 自动清理 |
| 临时执行文件 | 立即 | 执行后清理 |

**数据清理 API：**

```http
DELETE /api/v1/users/{userId}/data
Authorization: Bearer <API_KEY>
```

**响应:**
```json
{
  "success": true,
  "deletedFiles": 15,
  "freedBytes": 1048576
}
```

**定时数据清理任务：**
```python
# 每天凌晨 3 点清理闲置超过 30 天的用户数据
import os
import shutil
from datetime import datetime, timedelta

DATA_ROOT = "/var/lib/sandbox/users"
IDLE_DAYS = 30

def cleanup_idle_user_data():
    """清理闲置用户数据"""
    cutoff = datetime.now() - timedelta(days=IDLE_DAYS)
    cleaned = 0

    for user_dir in os.listdir(DATA_ROOT):
        user_path = os.path.join(DATA_ROOT, user_dir)
        workspace = os.path.join(user_path, "workspace")

        if not os.path.isdir(workspace):
            continue

        # 检查最后访问时间
        stat = os.stat(workspace)
        last_access = datetime.fromtimestamp(stat.st_atime)

        if last_access < cutoff:
            shutil.rmtree(user_path)
            cleaned += 1
            print(f"[Cleanup] Removed idle user data: {user_dir}")

    return cleaned
```

**配置项：**
```bash
# .env
USER_DATA_IDLE_DAYS=30    # 用户数据闲置天数阈值
CLEANUP_HOUR=3            # 清理任务执行时间（小时）
```

---

## 7. 部署方案

### 7.1 安装脚本

```bash
#!/bin/bash
# deploy/install.sh
# nsjail 沙盒服务安装脚本

set -e

echo "=== 沙盒服务安装脚本 ==="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查root权限
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请使用root权限运行此脚本${NC}"
  exit 1
fi

# 1. 安装系统依赖
echo -e "${YELLOW}[1/6] 安装系统依赖...${NC}"
apt update
apt install -y \
    build-essential \
    pkg-config \
    libprotobuf-dev \
    protobuf-compiler \
    libnl-route-3-dev \
    libcap-dev \
    python3 \
    python3-pip \
    python3-venv

# 2. 编译安装 nsjail
echo -e "${YELLOW}[2/6] 安装 nsjail...${NC}"
if ! command -v nsjail &> /dev/null; then
    cd /tmp
    git clone https://github.com/google/nsjail.git
    cd nsjail
    make
    cp nsjail /usr/local/bin/
    chmod +x /usr/local/bin/nsjail
    cd /
    rm -rf /tmp/nsjail
fi
echo -e "${GREEN}✓ nsjail 安装完成${NC}"

# 3. 创建目录结构
echo -e "${YELLOW}[3/6] 创建目录结构...${NC}"
mkdir -p /var/lib/sandbox/{rootfs,users}
mkdir -p /var/lib/sandbox/rootfs/{bin,usr/bin,usr/lib,lib/x86_64-linux-gnu,lib64,tmp,var}
mkdir -p /etc/sandbox/ssl
mkdir -p /var/log/sandbox
chmod 700 /var/lib/sandbox/users

# 4. 创建最小化 rootfs（仅包含必要二进制和依赖）
echo -e "${YELLOW}[4/6] 创建 rootfs...${NC}"

# 复制必要的 shell 和基础工具
cp /bin/bash /var/lib/sandbox/rootfs/bin/
cp /bin/sh /var/lib/sandbox/rootfs/bin/ 2>/dev/null || ln -s bash /var/lib/sandbox/rootfs/bin/sh
cp /bin/ls /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true
cp /bin/cat /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true
cp /bin/mkdir /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true
cp /bin/rm /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true

# 复制 Python3 运行时
cp /usr/bin/python3 /var/lib/sandbox/rootfs/usr/bin/
cp -r /usr/lib/python3* /var/lib/sandbox/rootfs/usr/lib/ 2>/dev/null || true

# 复制 Node.js 运行时（如果安装了）
cp /usr/bin/node /var/lib/sandbox/rootfs/usr/bin/ 2>/dev/null || true
cp -r /usr/lib/node_modules /var/lib/sandbox/rootfs/usr/lib/ 2>/dev/null || true

# 复制网络工具（curl/wget 用于网络请求）
cp /usr/bin/curl /var/lib/sandbox/rootfs/usr/bin/ 2>/dev/null || true
cp /usr/bin/wget /var/lib/sandbox/rootfs/usr/bin/ 2>/dev/null || true

# 复制必要的共享库（使用 ldd 自动收集依赖）
copy_deps() {
    local bin=$1
    ldd "$bin" 2>/dev/null | grep -o '/lib[^ ]*' | while read lib; do
        mkdir -p "/var/lib/sandbox/rootfs$(dirname "$lib")"
        cp -n "$lib" "/var/lib/sandbox/rootfs$lib" 2>/dev/null || true
    done
}

# 收集所有已复制二进制的依赖
for bin in /var/lib/sandbox/rootfs/bin/* /var/lib/sandbox/rootfs/usr/bin/*; do
    [ -x "$bin" ] && copy_deps "$bin"
done

# 复制基础运行时库
cp /lib/x86_64-linux-gnu/libc.so.6 /var/lib/sandbox/rootfs/lib/x86_64-linux-gnu/ 2>/dev/null || true
cp /lib/x86_64-linux-gnu/libdl.so.2 /var/lib/sandbox/rootfs/lib/x86_64-linux-gnu/ 2>/dev/null || true
cp /lib/x86_64-linux-gnu/libpthread.so.0 /var/lib/sandbox/rootfs/lib/x86_64-linux-gnu/ 2>/dev/null || true
cp /lib64/ld-linux-x86-64.so.2 /var/lib/sandbox/rootfs/lib64/ 2>/dev/null || true

# 移除可能的 setuid 二进制（安全加固）
find /var/lib/sandbox/rootfs -perm -4000 -exec chmod -s {} \; 2>/dev/null || true

# 5. 安装 Python 服务
echo -e "${YELLOW}[5/6] 安装 sandbox-service...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SRC="$SCRIPT_DIR/.."

python3 -m venv /opt/sandbox-service/venv
source /opt/sandbox-service/venv/bin/activate
pip install -r "$SERVICE_SRC/deploy/requirements.txt"
cp -r "$SERVICE_SRC/src" /opt/sandbox-service/
cp -r "$SERVICE_SRC/config" /etc/sandbox/
cp "$SERVICE_SRC/.env.example" /opt/sandbox-service/.env

deactivate

# 6. 安装 systemd 服务
echo -e "${YELLOW}[6/6] 安装 systemd 服务...${NC}"
cp "$SCRIPT_DIR/sandbox-service.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable sandbox-service

# 完成
echo -e "${GREEN}=== 安装完成 ===${NC}"
echo "请编辑 /opt/sandbox-service/.env 配置 API_KEY 和证书"
echo "启动服务: systemctl start sandbox-service"
```

### 7.2 systemd 服务

```ini
# deploy/sandbox-service.service
[Unit]
Description=Sandbox Service (nsjail)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/sandbox-service
Environment="PATH=/opt/sandbox-service/venv/bin"
ExecStart=/opt/sandbox-service/venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile /etc/sandbox/ssl/key.pem --ssl-certfile /etc/sandbox/ssl/cert.pem
Restart=always
RestartSec=5

# 安全加固
NoNewPrivileges=false  # nsjail 需要 CAP_SYS_ADMIN
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

---

## 8. 迁移计划

### 8.1 需要移除的文件

```
sandbox-gateway/                    # 旧 Node.js Gateway
deploy/sandbox-deploy/              # 旧部署脚本
deploy/scripts/create-standalone-package.sh
```

### 8.2 需要更新的文件

| 文件 | 更新内容 |
|------|---------|
| `lib/sandbox/config.ts` | 更新默认 URL，移除 Zeroboot 相关注释 |
| `.env.local.example` | 更新 SANDBOX_GATEWAY_URL 说明 |

### 8.3 新增文件

```
sandbox-service/                    # 新沙盒服务项目
docs/superpowers/specs/2026-03-22-sandbox-redesign-design.md
```

---

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| nsjail 内核漏洞 | 低 | 高 | 及时更新内核和 nsjail |
| 资源耗尽 | 中 | 中 | 严格的 cgroup 限制 |
| API Key 泄露 | 中 | 高 | 使用 TLS + 定期轮换 |
| 路径遍历攻击 | 低 | 高 | 严格的路径验证 |

---

## 10. 前提条件

### 10.1 系统要求

| 组件 | 要求 | 说明 |
|------|------|------|
| Linux 内核 | 3.8+ | 支持 user namespace |
| cgroup | v1 或 v2 | 资源限制 |
| Python | 3.9+ | FastAPI 运行时 |
| 内存 | 2GB+ | 服务器最低配置 |

### 10.2 内核配置检查

```bash
# 检查 namespace 支持
ls /proc/self/ns/

# 检查 cgroup 支持
cat /proc/filesystems | grep cgroup

# 检查 user namespace（最关键）
cat /proc/sys/kernel/unprivileged_userns_clone
# 应返回 1 或未启用但 root 可用
```

### 10.3 必需的系统能力

nsjail 需要以下 Linux capabilities：
- `CAP_SYS_ADMIN` - 创建命名空间
- `CAP_SYS_CHROOT` - chroot 操作
- `CAP_SETUID` / `CAP_SETGID` - 用户映射

---

## 11. 日志审计设计

### 11.1 审计日志格式

```json
{
  "timestamp": "2026-03-22T10:00:00.000Z",
  "event": "EXEC",
  "sessionId": "session-123",
  "userId": "user-456",
  "language": "bash",
  "codeSize": 128,
  "exitCode": 0,
  "execTimeMs": 150,
  "clientIp": "1.2.3.4"
}
```

### 11.2 记录的事件类型

| 事件 | 说明 |
|------|------|
| `SESSION_CREATE` | 会话创建 |
| `SESSION_DELETE` | 会话删除 |
| `EXEC` | 代码执行 |
| `FILE_READ` | 文件读取 |
| `FILE_WRITE` | 文件写入 |
| `AUTH_FAILURE` | 认证失败 |
| `RATE_LIMITED` | 触发速率限制 |
| `SECURITY_VIOLATION` | 安全违规（路径遍历等） |

### 11.3 日志配置

```python
# 日志写入 /var/log/sandbox/audit.log
# 自动轮转，保留 30 天

import logging
from logging.handlers import RotatingFileHandler

audit_logger = logging.getLogger('audit')
audit_logger.setLevel(logging.INFO)
handler = RotatingFileHandler(
    '/var/log/sandbox/audit.log',
    maxBytes=100*1024*1024,  # 100MB
    backupCount=30
)
audit_logger.addHandler(handler)
```

---

## 12. systemd capabilities 说明

nsjail 需要特权操作，具体需要的能力：

```ini
# sandbox-service.service 安全配置
[Service]
# nsjail 需要的能力
AmbientCapabilities=CAP_SYS_ADMIN CAP_SYS_CHROOT CAP_SETUID CAP_SETGID CAP_NET_RAW

# 允许这些能力但限制其他
CapabilityBoundingSet=CAP_SYS_ADMIN CAP_SYS_CHROOT CAP_SETUID CAP_SETGID CAP_NET_RAW CAP_KILL

# 其他安全设置仍然有效
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-03-22 | 初始设计 |