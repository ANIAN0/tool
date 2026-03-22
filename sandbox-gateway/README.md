# Sandbox Gateway 服务部署文档

> **独立部署说明**: 本服务与 AgentChat 应用完全独立，可部署在独立的服务器上。

## 目录

1. [系统要求](#系统要求)
2. [架构概述](#架构概述)
3. [安装步骤](#安装步骤)
4. [配置说明](#配置说明)
5. [服务管理](#服务管理)
6. [API 接口](#api-接口)
7. [安全配置](#安全配置)
8. [故障排查](#故障排查)

---

## 系统要求

### 硬件要求

| 组件 | 最低要求 | 推荐配置 |
|------|---------|---------|
| CPU | 2核，支持 VT-x/AMD-V | 4核+ |
| 内存 | 4GB | 8GB+ |
| 存储 | 20GB | 100GB+ SSD |
| 网络 | 内网访问 | 千兆内网 |

### 软件要求

- **操作系统**: Ubuntu 22.04 LTS 或更高版本
- **Node.js**: v18.0.0 或更高版本
- **KVM/QEMU**: 用于 Zeroboot 虚拟化
- **Zeroboot**: 沙盒执行引擎

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentChat 应用服务器                      │
│  (lib/sandbox/tools.ts → getSandboxManager() → HTTP API)    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP API (内网)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sandbox Gateway (:8080)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 认证中间件    │  │ 会话管理    │  │ 用户数据持久化       │  │
│  │ (API Key)   │  │ (Session)   │  │ (/var/lib/zeroboot) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP API (本地)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Zeroboot (:8081)                         │
│              KVM/Firecracker 轻量级 VM 执行环境                │
└─────────────────────────────────────────────────────────────┘
```

### 用户数据隔离

- 每个用户的数据存储在独立目录：`/var/lib/zeroboot/users/{hash(userId)}/workspace/`
- 用户 ID 经过 SHA256 哈希处理，防止 ID 枚举攻击
- 不同用户之间完全隔离，无法互相访问

---

## 安装步骤

### 方式一：使用部署脚本（推荐）

```bash
# 1. 克隆仓库或复制部署文件
cd /opt
git clone <repo-url> my-app
cd my-app

# 2. 运行部署脚本（需要 root 权限）
sudo bash deploy/sandbox-deploy/deploy.sh
```

### 方式二：手动安装

#### 步骤 1: 安装系统依赖

```bash
# 检查 CPU 虚拟化支持
grep -E '(vmx|svm)' /proc/cpuinfo || echo "警告: CPU 不支持虚拟化"

# 安装依赖包
sudo apt update
sudo apt install -y curl wget git build-essential libssl-dev pkg-config \
    qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils
```

#### 步骤 2: 创建系统用户和目录

```bash
# 创建 zeroboot 系统用户
sudo useradd --system --no-create-home --shell /bin/false \
    --comment "Zeroboot Service" zeroboot

# 创建必要目录
sudo mkdir -p /var/lib/zeroboot/{templates,users,logs}
sudo mkdir -p /var/run/zeroboot
sudo chown -R zeroboot:zeroboot /var/lib/zeroboot
sudo chown -R zeroboot:zeroboot /var/run/zeroboot
sudo chmod 700 /var/lib/zeroboot/users
```

#### 步骤 3: 安装 Node.js

```bash
# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应显示 v18.x.x
npm --version
```

#### 步骤 4: 安装 Zeroboot

```bash
# 下载 Zeroboot（请从官方获取）
# https://github.com/anthropics/zeroboot/releases

# 安装到系统路径
sudo cp zeroboot /usr/local/bin/
sudo chmod +x /usr/local/bin/zeroboot
```

#### 步骤 5: 安装 Sandbox Gateway

```bash
# 创建服务目录
sudo mkdir -p /opt/sandbox-gateway

# 复制源代码
sudo cp -r sandbox-gateway/* /opt/sandbox-gateway/

# 安装依赖
cd /opt/sandbox-gateway
sudo npm install --production

# 设置权限
sudo chown -R zeroboot:zeroboot /opt/sandbox-gateway
```

#### 步骤 6: 配置环境变量

```bash
# 复制配置模板
sudo cp deploy/sandbox-deploy/config/.env.example /opt/sandbox-gateway/.env

# 编辑配置（重要：修改 API_KEY！）
sudo nano /opt/sandbox-gateway/.env
```

#### 步骤 7: 安装 systemd 服务

```bash
# 复制服务配置
sudo cp deploy/sandbox-deploy/systemd/zeroboot.service /etc/systemd/system/
sudo cp deploy/sandbox-deploy/systemd/sandbox-gateway.service /etc/systemd/system/

# 重载 systemd
sudo systemctl daemon-reload

# 启用并启动服务
sudo systemctl enable zeroboot sandbox-gateway
sudo systemctl start zeroboot
sleep 3
sudo systemctl start sandbox-gateway
```

---

## 配置说明

### 环境变量 (.env)

```bash
# ==================== 服务配置 ====================
PORT=8080                           # Gateway 监听端口
NODE_ENV=production                 # 运行环境

# ==================== Zeroboot 配置 ====================
ZERBOOT_URL=http://127.0.0.1:8081   # Zeroboot 服务地址
ZERBOOT_TIMEOUT_MS=60000            # Zeroboot 请求超时（毫秒）

# ==================== 用户数据存储 ====================
USER_DATA_ROOT=/var/lib/zeroboot/users  # 用户数据根目录

# ==================== 认证配置 ====================
API_KEY=your-secure-api-key-here    # API 密钥（必须修改！）

# ==================== 会话配置 ====================
IDLE_TIMEOUT_MS=1800000             # 闲置超时（毫秒，默认 30 分钟）

# ==================== 安全配置 ====================
MAX_CODE_SIZE=1048576               # 最大代码大小（字节，默认 1MB）
MAX_FILE_SIZE=10485760              # 最大文件大小（字节，默认 10MB）
MAX_STORAGE_PER_USER=1073741824     # 每用户最大存储（字节，默认 1GB）
```

### 重要配置项说明

| 配置项 | 说明 | 安全建议 |
|--------|------|---------|
| `API_KEY` | 认证密钥，必须与 AgentChat 配置一致 | 使用强随机字符串（32+字符） |
| `USER_DATA_ROOT` | 用户数据存储目录 | 确保目录权限为 700 |
| `MAX_STORAGE_PER_USER` | 单用户存储配额 | 根据磁盘容量调整 |

---

## 服务管理

### 启动/停止服务

```bash
# 启动所有服务
sudo systemctl start zeroboot sandbox-gateway

# 停止所有服务
sudo systemctl stop sandbox-gateway zeroboot

# 重启 Gateway（不影响 Zeroboot）
sudo systemctl restart sandbox-gateway

# 查看服务状态
sudo systemctl status sandbox-gateway
sudo systemctl status zeroboot
```

### 查看日志

```bash
# 实时查看 Gateway 日志
sudo journalctl -u sandbox-gateway -f

# 查看最近 100 行日志
sudo journalctl -u sandbox-gateway -n 100

# 查看 Zeroboot 日志
sudo journalctl -u zeroboot -f
```

### 健康检查

```bash
# 检查 Gateway 健康状态
curl http://localhost:8080/health

# 预期响应
{
  "status": "healthy",
  "timestamp": "2026-03-22T10:00:00.000Z",
  "version": "1.0.0"
}
```

---

## API 接口

### 认证方式

所有 API 请求需要在 Header 中携带 API Key：

```
X-API-Key: your-secure-api-key
```

### 接口列表

#### 执行命令

```http
POST /api/v1/sessions/{sessionId}/exec
Content-Type: application/json
X-API-Key: your-api-key

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
Content-Type: application/json
X-API-Key: your-api-key

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
Content-Type: application/json
X-API-Key: your-api-key

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

#### 发送心跳

```http
POST /api/v1/sessions/{sessionId}/heartbeat
X-API-Key: your-api-key
```

**响应:**
```json
{
  "success": true
}
```

#### 查询会话状态

```http
GET /api/v1/sessions/{sessionId}/status
X-API-Key: your-api-key
```

**响应:**
```json
{
  "status": "active",
  "lastActivity": 1711094400000
}
```

---

## 安全配置

### 1. 防火墙配置

```bash
# 只允许内网访问 Gateway
sudo ufw allow from 10.0.0.0/8 to any port 8080
sudo ufw allow from 172.16.0.0/12 to any port 8080
sudo ufw allow from 192.168.0.0/16 to any port 8080

# 启用防火墙
sudo ufw enable
```

### 2. 生成安全的 API Key

```bash
# 生成 32 字符随机密钥
openssl rand -hex 16

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 3. 目录权限

```bash
# 确保用户数据目录权限正确
sudo chmod 700 /var/lib/zeroboot/users
sudo chown -R zeroboot:zeroboot /var/lib/zeroboot
```

### 4. systemd 安全加固

服务配置已包含以下安全措施：
- `NoNewPrivileges=true` - 禁止提权
- `ProtectSystem=strict` - 保护系统文件
- `ProtectHome=true` - 隔离 home 目录
- `PrivateTmp=true` - 使用私有临时目录
- `MemoryMax=1G` - 内存限制

---

## 故障排查

### 常见问题

#### 1. 服务无法启动

**症状:** `systemctl start sandbox-gateway` 失败

**排查步骤:**
```bash
# 检查日志
sudo journalctl -u sandbox-gateway -n 50

# 常见原因:
# 1. 端口被占用
sudo lsof -i :8080

# 2. 配置文件错误
cat /opt/sandbox-gateway/.env

# 3. Node.js 版本不兼容
node --version  # 需要 v18+
```

#### 2. Zeroboot 连接失败

**症状:** 日志显示 "Zeroboot服务不可用"

**排查步骤:**
```bash
# 检查 Zeroboot 服务状态
sudo systemctl status zeroboot

# 测试 Zeroboot 连接
curl http://127.0.0.1:8081/health

# 检查 KVM 支持
grep -E '(vmx|svm)' /proc/cpuinfo
ls -la /dev/kvm
```

#### 3. API 认证失败

**症状:** 返回 401 错误

**排查步骤:**
```bash
# 检查 API Key 配置
grep API_KEY /opt/sandbox-gateway/.env

# 测试认证
curl -H "X-API-Key: your-api-key" http://localhost:8080/api/v1/sessions/test/status
```

#### 4. 用户数据丢失

**症状:** 用户文件不存在

**排查步骤:**
```bash
# 检查用户数据目录
ls -la /var/lib/zeroboot/users/

# 检查目录权限
stat /var/lib/zeroboot/users

# 检查磁盘空间
df -h /var/lib/zeroboot
```

#### 5. 执行超时

**症状:** 命令执行超过 60 秒无响应

**排查步骤:**
```bash
# 检查 VM 状态
# Zeroboot 日志
sudo journalctl -u zeroboot -n 100

# 考虑增加超时时间
# 修改 .env 中的 ZERBOOT_TIMEOUT_MS
```

### 性能调优

```bash
# 增加 Gateway 内存限制
sudo nano /etc/systemd/system/sandbox-gateway.service
# 修改 MemoryMax=2G

# 重载并重启
sudo systemctl daemon-reload
sudo systemctl restart sandbox-gateway
```

---

## 与 AgentChat 集成

在 AgentChat 服务器的 `.env.local` 中添加：

```bash
# 启用沙盒功能
SANDBOX_ENABLED=true

# Gateway 服务地址（使用内网 IP）
SANDBOX_GATEWAY_URL=http://sandbox-server-internal-ip:8080

# API 密钥（与 Gateway 配置一致）
SANDBOX_API_KEY=your-secure-api-key
```

重启 AgentChat 服务后，Agent 将自动获得 `bash`、`readFile`、`writeFile` 工具。

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-03-22 | 初始版本 |

---

## 支持

如有问题，请查看：
1. 本文档的故障排查部分
2. 服务日志: `journalctl -u sandbox-gateway -f`
3. 项目文档: `docs/功能开发/沙盒服务部署实施文档.md`