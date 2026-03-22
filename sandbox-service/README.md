# Sandbox Service

基于 nsjail 的轻量级代码沙盒服务，适用于无虚拟化支持的云服务器环境。

## 功能

- 执行 bash/python/node 代码
- 文件读写操作
- 用户数据隔离
- 资源限制（内存 100MB，执行时间 60秒）
- 网络访问支持
- HTTPS API

## 系统要求

- Linux 内核 3.8+（支持 user namespace）
- Python 3.9+
- 2GB+ 内存

## 安装

```bash
sudo bash deploy/install.sh
```

## 配置

编辑 `/opt/sandbox-service/.env`:

```bash
API_KEY=your-secure-api-key
```

## 启动服务

```bash
sudo systemctl start sandbox-service
```

## API 使用

```bash
# 执行代码
curl -X POST https://localhost:8443/api/v1/sessions/session-1/exec \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "code": "echo Hello", "language": "bash"}'
```

## 安全说明

- 使用 nsjail 进行进程隔离
- 用户数据存储在独立目录
- 路径遍历防护
- API Key 认证