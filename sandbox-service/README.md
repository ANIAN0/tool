# Sandbox Service

基于 nsjail 的轻量级代码沙盒服务，适用于无完整虚拟化支持的 Linux 云主机。

## 功能

- 执行 bash / python / node 代码（通过 nsjail 单次任务）
- 按用户隔离的工作区文件读写（HTTP API）
- 资源与命名空间限制见 `config/nsjail.conf`（如 `time_limit`、`rlimit_*`）
- 当前配置下 **`clone_newnet: false`**，沙盒与宿主机共享网络命名空间；若需禁网需在配置中改为 `clone_newnet: true` 并自行评估业务需求
- HTTP API + API Key 认证

## 系统要求

- Linux 内核支持 user namespace（一般 3.8+）
- Docker（仅用于从官方镜像提取 `nsjail` 二进制；也可自行编译安装）
- Python 3.9+
- 建议 2GB+ 内存
- 部署与执行 nsjail 需要 **root**（systemd 单元已按 root 运行设计）

## 安装

### 方法一：自动安装脚本（推荐）

在仓库 `sandbox-service` 目录下执行：

```bash
sudo bash deploy/install.sh
```

脚本会：安装依赖、用 uv 创建虚拟环境、从 `ghcr.io/google/nsjail/nsjail` 安装 nsjail、创建目录与最小 rootfs、拷贝服务与 `config` 到 `/opt/sandbox-service`、`/etc/sandbox`，并注册 systemd 服务。

### 方法二：手动安装

步骤与脚本一致时可对照 `deploy/install.sh`。下面为精简对照，**请勿遗漏与 nsjail 相关的目录权限**（见下文「与 nsjail 相关的权限」）。

#### 1. 系统依赖

```bash
apt update
apt install -y docker.io python3 python3-venv curl
```

#### 2. 安装 uv

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

#### 3. 安装 nsjail（从镜像复制）

```bash
docker pull ghcr.io/google/nsjail/nsjail:latest
docker create --name temp-nsjail ghcr.io/google/nsjail/nsjail:latest
docker cp temp-nsjail:/usr/bin/nsjail /usr/local/bin/nsjail
docker rm temp-nsjail
chmod +x /usr/local/bin/nsjail
nsjail --help
```

若宿主 glibc 与镜像不兼容导致二进制无法运行，请在宿主机上从源码编译 nsjail 再安装到 `/usr/local/bin/nsjail`。

#### 4. 目录结构

```bash
mkdir -p /var/lib/sandbox/{rootfs,users}
mkdir -p /var/lib/sandbox/rootfs/{bin,usr/bin,usr/lib,lib/x86_64-linux-gnu,lib64,tmp,var}
mkdir -p /var/lib/sandbox/rootfs/etc/ssl/certs
mkdir -p /etc/sandbox
mkdir -p /var/log/sandbox
# 必须为 711：见下文「与 nsjail 相关的权限」
chmod 711 /var/lib/sandbox/users
```

#### 5. rootfs（最小运行环境）

将宿主上的 `bash`、`python3`（及可选 `node`）及其 `ldd` 依赖拷入 `/var/lib/sandbox/rootfs`，可参考 `deploy/install.sh` 中的 `copy_deps` 循环与证书拷贝逻辑。

#### 6. Python 服务

```bash
# 将 SERVICE_SRC 换成本机 sandbox-service 源码根目录
SERVICE_SRC=/path/to/sandbox-service

uv venv /opt/sandbox-service/venv
source /opt/sandbox-service/venv/bin/activate
uv pip install -r "$SERVICE_SRC/deploy/requirements.txt"

cp -r "$SERVICE_SRC/src" /opt/sandbox-service/
cp -r "$SERVICE_SRC/config" /etc/sandbox/
cp "$SERVICE_SRC/.env.example" /opt/sandbox-service/.env

deactivate
```

#### 7. systemd

```bash
cp "$SERVICE_SRC/deploy/sandbox-service.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable sandbox-service
```

## 配置

编辑 `/opt/sandbox-service/.env`（工作目录为 `/opt/sandbox-service` 时 pydantic 会自动读取该文件）：

```bash
API_KEY=$(openssl rand -hex 32)
sed -i "s/API_KEY=.*/API_KEY=$API_KEY/" /opt/sandbox-service/.env
cat /opt/sandbox-service/.env
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 8443 | 监听端口 |
| API_KEY | （空） | **必须设置**，请求头 `Authorization: Bearer <API_KEY>` |
| USER_DATA_ROOT | /var/lib/sandbox/users | 用户数据根目录（当前 `SessionManager` 默认与此一致；若改配置需同步改代码中的会话根路径） |
| IDLE_TIMEOUT_MS | 1800000 | 会话空闲超时（毫秒） |
| MAX_CODE_SIZE | 1048576 | 允许提交的代码最大字节数 |

nsjail 行为以 `/etc/sandbox/nsjail.conf` 为准。

## 启动与升级

```bash
sudo systemctl start sandbox-service
sudo systemctl status sandbox-service
```

**升级代码**：替换 `/opt/sandbox-service/src`（及必要时 `/etc/sandbox` 下配置）后执行：

```bash
sudo systemctl restart sandbox-service
```

## 安装后目录结构

安装完成后，相关文件分布如下：

```
/opt/sandbox-service/
├── venv/                    # Python 虚拟环境（uv 创建）
├── src/
│   ├── main.py              # 服务入口（uvicorn 启动）
│   └── services/
│       ├── sandbox.py       # 沙盒执行模块（调用 nsjail）
│       └── session.py       # 会话管理模块（用户隔离）
└── .env                     # 环境配置（API_KEY 等）

/etc/sandbox/
├── nsjail.conf              # nsjail 配置文件
└── ssl/                     # SSL 证书目录（可选）

/var/lib/sandbox/
├── rootfs/                  # 沙盒最小 rootfs
│   ├── bin/                 # bash、sh、ls、cat、mkdir、rm
│   ├── usr/bin/             # python3、node（可选）
│   ├── usr/lib/             # Python/Node 运行库
│   ├── lib/                 # 系统依赖库
│   └── etc/ssl/certs/       # CA 证书
├── users/                   # 用户数据根目录（权限 711）
│   └── <user_hash>/         # 用户目录（userId SHA256 前 16 位）
│       └── workspace/       # 用户工作区（权限 777）
└── logs/                    # 日志目录

/var/log/sandbox/
└── audit.log                # 审计日志

/etc/systemd/system/
└── sandbox-service.service  # systemd 服务单元
```

**关键文件说明：**

| 文件/目录 | 作用 | 备注 |
|-----------|------|------|
| `/opt/sandbox-service/.env` | 服务配置 | 必须设置 `API_KEY` |
| `/etc/sandbox/nsjail.conf` | 沙盒配置 | 资源限制、命名空间、挂载点 |
| `/var/lib/sandbox/users/` | 用户数据 | 按用户隔离，目录权限 `711` |
| `workspace/` | 工作区 | 用户文件读写，权限 `777` |

## 卸载

如需卸载沙盒服务，按以下步骤操作：

```bash
# 1. 停止并禁用服务
sudo systemctl stop sandbox-service
sudo systemctl disable sandbox-service

# 2. 删除 systemd 服务文件
sudo rm /etc/systemd/system/sandbox-service.service
sudo systemctl daemon-reload

# 3. 删除安装目录
sudo rm -rf /opt/sandbox-service
sudo rm -rf /etc/sandbox

# 4. 可选：删除用户数据（谨慎操作）
sudo rm -rf /var/lib/sandbox/users

# 5. 可选：删除 rootfs 和日志
sudo rm -rf /var/lib/sandbox
sudo rm -rf /var/log/sandbox

# 6. 可选：卸载 nsjail
sudo rm /usr/local/bin/nsjail
```

**注意：** 步骤 4-6 会删除所有用户数据和运行环境，请确保已备份重要数据后再执行。

## API 使用

本服务 **默认提供 HTTP**（uvicorn 未内置 TLS）。前面接 Nginx 等做 HTTPS 时，客户端应对外访问 `https://...`，而不是误用 `https://` 直连未配证书的 8443。

### 健康检查

```bash
curl http://127.0.0.1:8443/api/v1/health
```

### 执行代码

**bash 示例：**

```bash
curl -X POST http://127.0.0.1:8443/api/v1/sessions/my-session/exec \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "code": "mkdir -p test && ls -la", "language": "bash"}'
```

**响应示例：**

```json
{
  "success": true,
  "stdout": "total 8\ndrwxrwxrwx  2 65534 65534 4096 Mar 27 22:00 .\n...\n",
  "stderr": "[I][2026-03-27T22:00:00+0800] Mode: STANDALONE_ONCE\n...",
  "exitCode": 0,
  "execTimeMs": 152
}
```

**Python 示例：**

```bash
curl -X POST http://127.0.0.1:8443/api/v1/sessions/my-session/exec \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "code": "import os\nprint(f\"cwd: {os.getcwd()}\")\nprint(f\"files: {os.listdir()}\")", "language": "python"}'
```

**Node.js 示例：**

```bash
curl -X POST http://127.0.0.1:8443/api/v1/sessions/my-session/exec \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "code": "const fs = require(\"fs\");\nconsole.log(\"cwd:", process.cwd());\nconsole.log(\"files:", fs.readdirSync(\".\"));", "language": "node"}'
```

**错误处理示例（exitCode 非 0）：**

```bash
curl -X POST http://127.0.0.1:8443/api/v1/sessions/my-session/exec \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "code": "cat /nonexistent", "language": "bash"}'
```

```json
{
  "success": true,
  "stdout": "",
  "stderr": "cat: /nonexistent: No such file or directory\n[I][...] exited with status: 1",
  "exitCode": 1,
  "execTimeMs": 89
}
```

### 读取 / 写入文件

读写路径为相对用户工作区的相对路径；需保证该 `session_id` 已在当前进程内通过 `exec` 等方式创建过会话（会话状态在内存中，**重启服务后会丢失**，需重新 `exec`）。

```bash
curl -X POST http://127.0.0.1:8443/api/v1/sessions/session-1/read \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "path": "output.txt"}'
```

```bash
curl -X POST http://127.0.0.1:8443/api/v1/sessions/session-1/write \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "path": "test.txt", "content": "Hello World"}'
```

### 执行接口响应说明

| 字段 | 含义 |
|------|------|
| success | 业务层调用完成（未发生未捕获异常） |
| stdout / stderr | 沙盒内命令的标准输出与标准错误 |
| exitCode | **沙盒内进程退出码**，`0` 表示命令成功；非 0 需结合 stderr 判断 |
| execTimeMs | 耗时（毫秒） |

**stderr 中常含 nsjail 以 `[I]` 开头的信息日志**，与真正错误可一并查看；若仅需判断成功与否，**以 `exitCode` 为准**。

## 与 nsjail 相关的权限（重要）

默认 `nsjail.conf` 使用 `uidmap` / `gidmap`（如沙盒内 `0` 映射到宿主 `65534`）。对 **bind mount 的源目录** 及挂载后访问的 **工作区内文件**，内核会按映射后的宿主身份做权限检查。因此：

1. **`/var/lib/sandbox/users` 及每个用户目录**
   使用 **`711`（rwx--x--x）**，使路径可被「穿越」；**`700` 会导致 bind mount `Permission denied`**。
   当前代码会在服务启动时将 `users` 目录设为 `711`。

2. **用户 workspace 子目录**
   使用 **`777`（rwxrwxrwx）**。
   原因：容器内进程以 root(0) 运行，映射到宿主 nobody(65534)；对 nobody 拥有的目录，root 只是「其他人」，需要 `others` 有写权限才能创建文件/目录。
   **`711` 或 `755` 会导致 `mkdir Permission denied`**。

3. **服务生成的临时脚本文件**
   创建后为 **`644`**，否则映射身份无法读取 **`600`** 的 root 文件，会出现 `Permission denied` / 退出码 126。

4. **沙盒内执行路径**
   工作区挂载为 **`/workspace`**，解释器参数必须是 **`/workspace/<脚本文件名>`**，不能使用宿主机绝对路径。

## 日志

```bash
journalctl -u sandbox-service -f
tail -f /var/log/sandbox/audit.log
```

## 常见问题排查

| 现象 | 可能原因 | 解决方案 |
|------|----------|----------|
| `mkdir: Permission denied` | workspace 权限不足（非 777） | 检查 workspace 是否为 `777`；更新 session.py 并重启服务 |
| `ls: cannot open directory '/workspace'` | workspace 权限为 `711` | 更新 session.py，将 workspace 改为 `777` |
| `No such file` 且路径为 `/var/lib/sandbox/users/.../tmp*.sh` | 旧代码把宿主机路径传进沙盒 | 更新 `src/services/sandbox.py` 并重启 |
| nsjail 报 mount 失败，提示对目录 `chmod o+x` | `users` 或用户目录为 `700` | 改为 `711` 或更新会话相关代码后重启 |
| `bash: /workspace/xxx.sh: Permission denied`、退出码 126 | 临时脚本不可读 | 更新 sandbox.py（含 `chmod 644`）并重启 |
| 临时文件残留（tmp*.sh） | 服务异常终止或执行超时 | 手动清理 `sudo rm -f /var/lib/sandbox/users/*/workspace/tmp*.sh` |
| nsjail 日志大量 `[I]` 信息 | 正常日志输出（见下文） | 以 `exitCode` 判断成功与否 |
| 执行超时、`exitCode` 为非 0 | 代码运行超过 60 秒 | 调整 `nsjail.conf` 中 `time_limit` 或优化代码 |
| 401 | 缺少 / 格式错误的 `Authorization: Bearer` | 检查请求头格式与 `.env` 中 `API_KEY` |
| 403 | `session_id` 已绑定其他 `userId` | 使用正确的 userId 或新建 session |
| 404 SESSION_NOT_FOUND | 服务重启后会话丢失 | 重新执行 `exec` 创建会话 |

**nsjail 日志解读：**

stderr 中包含 nsjail 以 `[I]` 开头的信息日志，这是正常的执行记录，不是错误：

```
[I][时间戳] Mode: STANDALONE_ONCE      # 运行模式
[I][时间戳] Jail parameters: ...       # 沙盒参数配置
[I][时间戳] Mount: ...                 # 文件系统挂载信息
[I][时间戳] Uid map: ...               # UID/GID 映射
[I][时间戳] Executing '/bin/bash'      # 开始执行命令
[I][时间戳] pid=xxx exited with status: 0  # 执行完成，退出码
```

判断执行成功与否，应以 `exitCode` 为准：`0` 表示成功，非 `0` 表示失败。

## 安全说明

- nsjail 提供命名空间与资源限制（以配置文件为准）
- 用户目录按 `userId` 哈希分目录存储；API 层校验会话归属与路径遍历
- API Key 认证；生产环境建议仅内网或通过反向代理与 TLS 暴露
- `711` 目录允许在知道完整路径时穿越进入；哈希目录名应具备足够熵；多租户同机时请评估本地其他账户风险
