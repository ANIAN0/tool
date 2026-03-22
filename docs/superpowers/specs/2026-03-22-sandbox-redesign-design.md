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

---

## 4. nsjail 配置

### 4.1 主配置文件

```ini
# config/nsjail.conf

# ==================== 模式设置 ====================
mode: LISTEN  # 单次执行模式

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
# 工作空间挂载
mount: /var/lib/sandbox/users/{USER_HASH}/workspace:/workspace:rw

# 必要的系统目录 (只读)
mount: /bin:/bin:ro
mount: /usr:/usr:ro
mount: /lib:/lib:ro
mount: /lib64:/lib64:ro

# ==================== seccomp 过滤 ====================
# 允许的基础系统调用
seccomp_string: "ALLOW { read, write, open, close, stat, fstat, lstat, poll, lseek, mmap, mprotect, munmap, brk, rt_sigaction, rt_sigprocmask, rt_sigreturn, ioctl, pread64, pwrite64, readv, writev, access, pipe, select, sched_yield, mremap, msync, mincore, madvise, dup, dup2, pause, getitimer, alarm, setitimer, getpid, sendfile, socket, connect, accept, sendto, recvfrom, sendmsg, recvmsg, shutdown, bind, listen, getsockname, getpeername, socketpair, setsockopt, getsockopt, fork, vfork, execve, exit, wait4, kill, uname, fcntl, flock, fsync, fdatasync, truncate, ftruncate, getdents, getcwd, chdir, fchdir, rename, mkdir, rmdir, creat, link, unlink, symlink, readlink, chmod, fchmod, chown, fchown, lchown, umask, gettimeofday, getrlimit, getrusage, sysinfo, times, getuid, getgid, setuid, setgid, geteuid, getegid, setpgid, getppid, getpgrp, setsid, setreuid, setregid, getgroups, setgroups, setresuid, getresuid, setresgid, getresgid, getpgid, setfsuid, setfsgid, getsid, capget, capset, rt_sigpending, rt_sigtimedwait, rt_sigqueueinfo, sigaltstack, utime, mknod, uselib, personality, ustat, statfs, fstatfs, sysfs, getpriority, setpriority, sched_setparam, sched_getparam, sched_setscheduler, sched_getscheduler, sched_get_priority_max, sched_get_priority_min, sched_rr_get_interval, mlock, munlock, mlockall, munlockall, vhangup, pivot_root, _sysctl, prctl, arch_prctl, adjtimex, setrlimit, chroot, sync, acct, settimeofday, mount, umount2, swapon, swapoff, reboot, sethostname, setdomainname, iopl, ioperm, create_module, init_module, delete_module, get_kernel_syms, query_module, quotactl, nfsservctl, getpmsg, putpmsg, afs_syscall, tuxcall, security, gettid, readahead, setxattr, lsetxattr, fsetxattr, getxattr, lgetxattr, fgetxattr, listxattr, llistxattr, flistxattr, removexattr, lremovexattr, fremovexattr, tkill, time, futex, sched_setaffinity, sched_getaffinity, set_thread_area, io_setup, io_destroy, io_getevents, io_submit, io_cancel, get_thread_area, epol_create, epoll_ctl, epoll_wait, remap_file_pages, getdents64, set_tid_address, restart_syscall, semtimedop, fadvise64, timer_create, timer_settime, timer_gettime, timer_getoverrun, timer_delete, clock_settime, clock_gettime, clock_getres, clock_nanosleep, exit_group, epoll_wait, epoll_ctl, tgkill, utimes, mbind, set_mempolicy, get_mempolicy, mq_open, mq_unlink, mq_timedsend, mq_timedreceive, mq_notify, mq_getsetattr, kexec_load, waitid, add_key, request_key, keyctl, ioprio_set, ioprio_get, inotify_init, inotify_add_watch, inotify_rm_watch, migrate_pages, openat, mkdirat, mknodat, fchownat, futimesat, newfstatat, unlinkat, renameat, linkat, symlinkat, readlinkat, fchmodat, faccessat, pselect6, ppoll, unshare, set_robust_list, get_robust_list, splice, tee, sync_file_range, vmsplice, move_pages, utimensat, epoll_pwait, signalfd, timerfd_create, eventfd, fallocate, timerfd_settime, timerfd_gettime, accept4, signalfd4, eventfd2, epoll_create1, dup3, pipe2, inotify_init1, preadv, pwritev, rt_tgsigqueueinfo, perf_event_open, recvmmsg, fanotify_init, fanotify_mark, prlimit64, name_to_handle_at, open_by_handle_at, clock_adjtime, syncfs, sendmmsg, setns, getcpu, process_vm_readv, process_vm_writev, kcmp, finit_module, sched_setattr, sched_getattr, renameat2, seccomp, getrandom, memfd_create, kexec_file_load, bpf, execveat, userfaultfd, membarrier, mlock2, copy_file_range, preadv2, pwritev2, pkey_mprotect, pkey_alloc, pkey_free, statx }"
```

### 4.2 语言特定配置

```ini
# config/languages/python.conf
# Python 运行时额外配置

mount: /usr/bin/python3:/usr/bin/python3:ro
mount: /usr/lib/python3:/usr/lib/python3:ro
env: PYTHONIOENCODING=utf-8
```

```ini
# config/languages/node.conf
# Node.js 运行时额外配置

mount: /usr/bin/node:/usr/bin/node:ro
mount: /usr/lib/node_modules:/usr/lib/node_modules:ro
env: NODE_PATH=/usr/lib/node_modules
```

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

    def _hash_user_id(self, user_id: str) -> str:
        """对用户ID进行哈希处理"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:16]
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
mkdir -p /var/lib/sandbox/rootfs/{bin,usr,lib,lib64,tmp}
mkdir -p /etc/sandbox
chmod 700 /var/lib/sandbox/users

# 4. 创建最小化 rootfs
echo -e "${YELLOW}[4/6] 创建 rootfs...${NC}"
# 复制必要的二进制和库
cp -r /bin/* /var/lib/sandbox/rootfs/bin/
cp -r /usr /var/lib/sandbox/rootfs/
cp -r /lib/* /var/lib/sandbox/rootfs/lib/
cp -r /lib64/* /var/lib/sandbox/rootfs/lib64/ 2>/dev/null || true

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

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-03-22 | 初始设计 |